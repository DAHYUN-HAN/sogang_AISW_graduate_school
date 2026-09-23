from sqlalchemy import select

from app.models.board import Board
from app.models.dues_payer import DuesPayer
from app.models.media import PostAttachment
from app.models.post import Post


def _activity_board(api) -> int:
    with api.session() as db:
        board = Board(
            name="Study Activity Certification",
            slug="study-activity-dues-test",
            category="participation",
            board_type="activity_certification",
            read_permission="user",
            write_permission="user",
        )
        db.add(board)
        db.commit()
        return board.id


def _seed_payers(api) -> tuple[int, int]:
    with api.session() as db:
        first = DuesPayer(name="홍길동", major="인공지능", student_number="A74001")
        second = DuesPayer(name="김서강", major="보안", student_number="A74002")
        db.add_all([first, second])
        db.commit()
        return first.id, second.id


def _payload(payer_ids: list[int], *, participants: str = "위조된 이름") -> dict:
    return {
        "title": "지원금 활동 인증",
        "content": "활동 소감",
        "category": "테스트 활동",
        "metadata": {
            "activity_date": "2026.08.11",
            "participants": participants,
            "participant_dues_payer_ids": payer_ids,
            "bank_account": "서강은행 123",
        },
        "attachment_ids": [1],
        "is_anonymous": False,
    }


def test_activity_certification_uses_roster_names_in_selected_order(api) -> None:
    board_id = _activity_board(api)
    first_id, second_id = _seed_payers(api)

    response = api.client.post(
        f"/api/boards/{board_id}/posts",
        json=_payload([second_id, first_id]),
        headers=api.headers["owner"],
    )

    assert response.status_code == 200
    with api.session() as db:
        post = db.get(Post, response.json()["data"]["id"])
        assert post.metadata_json["participants"] == "74기 김서강, 74기 홍길동"
        assert post.metadata_json["participant_dues_payer_ids"] == [second_id, first_id]
        assert "participant_user_ids" not in post.metadata_json


def test_activity_certification_accepts_unpaid_and_current_board_once_participants(api) -> None:
    board_id = _activity_board(api)
    with api.session() as db:
        unpaid = DuesPayer(name="검증미납", major="인공지능", student_number="A74011")
        once = DuesPayer(
            name="검증현재행사",
            major="인공지능",
            student_number="A74012",
            once_board_id=board_id,
        )
        db.add_all([unpaid, once])
        db.commit()
        payer_ids = [unpaid.id, once.id]

    created = api.client.post(
        f"/api/boards/{board_id}/posts",
        json=_payload(payer_ids),
        headers=api.headers["owner"],
    )

    assert created.status_code == 200
    with api.session() as db:
        post = db.get(Post, created.json()["data"]["id"])
        assert post.metadata_json["participant_dues_payer_ids"] == payer_ids
        assert post.metadata_json["participants"] == "74기 검증미납, 74기 검증현재행사"


def test_activity_participant_snapshot_survives_payment_state_change_during_edit(api) -> None:
    board_id = _activity_board(api)
    first_id, second_id = _seed_payers(api)
    created = api.client.post(
        f"/api/boards/{board_id}/posts",
        json=_payload([first_id, second_id]),
        headers=api.headers["owner"],
    )
    assert created.status_code == 200

    with api.session() as db:
        first = db.get(DuesPayer, first_id)
        second = db.get(DuesPayer, second_id)
        first.is_full_paid = True
        second.once_board_id = board_id
        db.commit()

    edited = api.client.put(
        f"/api/posts/{created.json()['data']['id']}",
        json={
            "title": "수정된 인증",
            "content": "수정된 소감",
            "category": "테스트 활동",
            "metadata": {
                "activity_date": "2026.08.12",
                "participants": "74기 홍길동, 74기 김서강",
            },
            "attachment_ids": [1],
            "is_anonymous": False,
        },
        headers=api.headers["owner"],
    )

    assert edited.status_code == 200
    with api.session() as db:
        post = db.get(Post, created.json()["data"]["id"])
        assert post.metadata_json["participant_dues_payer_ids"] == [first_id, second_id]
        assert post.metadata_json["participants"] == "74기 홍길동, 74기 김서강"


def test_activity_certification_rejects_missing_empty_or_duplicate_payer_ids(api) -> None:
    board_id = _activity_board(api)
    first_id, _ = _seed_payers(api)

    responses = [
        api.client.post(
            f"/api/boards/{board_id}/posts",
            json=_payload([]),
            headers=api.headers["owner"],
        ),
        api.client.post(
            f"/api/boards/{board_id}/posts",
            json=_payload([first_id, first_id]),
            headers=api.headers["owner"],
        ),
        api.client.post(
            f"/api/boards/{board_id}/posts",
            json=_payload([9999]),
            headers=api.headers["owner"],
        ),
    ]

    assert [(response.status_code, response.json()["code"]) for response in responses] == [
        (422, "INVALID_DUES_PAYER"),
        (422, "INVALID_DUES_PAYER"),
        (422, "INVALID_DUES_PAYER"),
    ]
    with api.session() as db:
        assert db.scalar(select(Post).where(Post.board_id == board_id)) is None


def test_payment_reset_keeps_activity_participant_snapshot_and_roster_link(api) -> None:
    board_id = _activity_board(api)
    first_id, _ = _seed_payers(api)
    with api.session() as db:
        db.get(DuesPayer, first_id).is_full_paid = True
        db.commit()
    created = api.client.post(
        f"/api/boards/{board_id}/posts",
        json=_payload([first_id]),
        headers=api.headers["owner"],
    )

    reset = api.client.post(
        "/api/dues-payers/admin/payments/reset",
        json={"confirmation": "납부자 초기화"},
        headers=api.headers["admin"],
    )

    assert created.status_code == 200
    assert reset.status_code == 200
    with api.session() as db:
        post = db.get(Post, created.json()["data"]["id"])
        assert post.metadata_json["participants"] == "74기 홍길동"
        assert post.metadata_json["participant_dues_payer_ids"] == [first_id]
        payer = db.get(DuesPayer, first_id)
        assert payer is not None
        assert payer.is_full_paid is False


def test_unchanged_legacy_participants_survive_edit_but_changed_names_require_reselection(api) -> None:
    board_id = _activity_board(api)
    with api.session() as db:
        post = Post(
            board_id=board_id,
            author_id=1,
            title="기존 활동",
            content="기존 소감",
            category="기존 활동",
            metadata_json={
                "activity_date": "2026.07.01",
                "participants": "기존 참가자",
                "participant_user_ids": "1",
                "bank_account": "기존 계좌",
            },
        )
        db.add(post)
        db.flush()
        db.add(PostAttachment(post_id=post.id, media_id=1, sort_order=0))
        db.commit()
        post_id = post.id

    unchanged = api.client.put(
        f"/api/posts/{post_id}",
        json={
            "title": "수정된 활동",
            "content": "수정된 소감",
            "category": "기존 활동",
            "metadata": {"activity_date": "2026.07.02", "participants": "기존 참가자"},
            "attachment_ids": [1],
            "is_anonymous": False,
        },
        headers=api.headers["owner"],
    )
    changed = api.client.put(
        f"/api/posts/{post_id}",
        json={
            "title": "수정된 활동",
            "content": "수정된 소감",
            "category": "기존 활동",
            "metadata": {"activity_date": "2026.07.02", "participants": "임의 변경"},
            "attachment_ids": [1],
            "is_anonymous": False,
        },
        headers=api.headers["owner"],
    )

    assert unchanged.status_code == 200
    assert changed.status_code == 422
    assert changed.json()["code"] == "INVALID_DUES_PAYER"
    with api.session() as db:
        post = db.get(Post, post_id)
        assert post.metadata_json["participants"] == "기존 참가자"
        assert post.metadata_json["participant_user_ids"] == "1"
