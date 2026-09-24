from sqlalchemy import select

from app.models.board import Board
from app.models.dues_payment import DuesPayment
from app.models.media import PostAttachment
from app.models.post import Post
from app.models.student_roster import StudentRosterMember


def _activity_board(api, *, slug: str = "study-activity-dues-test") -> int:
    with api.session() as db:
        board = Board(
            name="Study Activity Certification",
            slug=slug,
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
        first = StudentRosterMember(name="홍길동", major="인공지능", student_number="A74001")
        second = StudentRosterMember(name="김서강", major="보안", student_number="A74002")
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
    other_board_id = _activity_board(api, slug="other-selectable-activity-dues")
    with api.session() as db:
        unpaid = StudentRosterMember(name="검증미납", major="인공지능", student_number="A74011")
        once = StudentRosterMember(
            name="검증현재행사",
            major="인공지능",
            student_number="A74012",
        )
        other_once = StudentRosterMember(
            name="검증다른행사",
            major="인공지능",
            student_number="A74013",
        )
        db.add_all([unpaid, once, other_once])
        db.flush()
        db.add_all(
            [
                DuesPayment(
                    roster_member_id=once.id,
                    scope="ONCE",
                    once_board_id=board_id,
                ),
                DuesPayment(
                    roster_member_id=other_once.id,
                    scope="ONCE",
                    once_board_id=other_board_id,
                ),
            ]
        )
        db.commit()
        payer_ids = [unpaid.id, once.id, other_once.id]

    created = api.client.post(
        f"/api/boards/{board_id}/posts",
        json=_payload(payer_ids),
        headers=api.headers["owner"],
    )

    assert created.status_code == 200
    with api.session() as db:
        post = db.get(Post, created.json()["data"]["id"])
        assert post.metadata_json["participant_dues_payer_ids"] == payer_ids
        assert post.metadata_json["participants"] == "74기 검증미납, 74기 검증현재행사, 74기 검증다른행사"


def test_search_derives_board_payment_from_optional_payment_row(api) -> None:
    board_id = _activity_board(api)
    other_board_id = _activity_board(api, slug="other-activity-dues-test")
    with api.session() as db:
        all_paid = StudentRosterMember(name="검증전체", major="AI", student_number="A74101")
        matching_once = StudentRosterMember(name="검증현재행사", major="AI", student_number="A74102")
        other_once = StudentRosterMember(name="검증다른행사", major="AI", student_number="A74103")
        unpaid = StudentRosterMember(name="검증미납", major="AI", student_number="A74104")
        db.add_all([all_paid, matching_once, other_once, unpaid])
        db.flush()
        db.add_all(
            [
                DuesPayment(roster_member_id=all_paid.id, scope="ALL"),
                DuesPayment(
                    roster_member_id=matching_once.id,
                    scope="ONCE",
                    once_board_id=board_id,
                ),
                DuesPayment(
                    roster_member_id=other_once.id,
                    scope="ONCE",
                    once_board_id=other_board_id,
                ),
            ]
        )
        db.commit()

    response = api.client.get(
        "/api/dues-payers/search",
        headers=api.headers["owner"],
        params={"q": "검증", "board_id": board_id},
    )

    assert response.status_code == 200
    states = {item["name"]: item["is_paid_for_board"] for item in response.json()["data"]}
    assert states == {
        "검증전체": True,
        "검증현재행사": True,
        "검증다른행사": False,
        "검증미납": False,
    }


def test_activity_certification_detail_exposes_current_board_payment_states(api) -> None:
    board_id = _activity_board(api)
    other_board_id = _activity_board(api, slug="other-detail-activity-dues-test")
    with api.session() as db:
        unpaid = StudentRosterMember(name="검증미납", major="AI", student_number="A99001")
        other_once = StudentRosterMember(name="검증다른행사", major="AI", student_number="A99002")
        all_paid = StudentRosterMember(name="검증전체", major="AI", student_number="A99003")
        db.add_all([unpaid, other_once, all_paid])
        db.flush()
        db.add_all(
            [
                DuesPayment(
                    roster_member_id=other_once.id,
                    scope="ONCE",
                    once_board_id=other_board_id,
                ),
                DuesPayment(roster_member_id=all_paid.id, scope="ALL"),
            ]
        )
        db.commit()
        payer_ids = [unpaid.id, other_once.id, all_paid.id]

    created = api.client.post(
        f"/api/boards/{board_id}/posts",
        json=_payload(payer_ids),
        headers=api.headers["owner"],
    )
    assert created.status_code == 200

    detail = api.client.get(
        f"/api/posts/{created.json()['data']['id']}",
        headers=api.headers["owner"],
    )

    assert detail.status_code == 200
    assert detail.json()["data"].get("activity_participants") == [
        {"id": unpaid.id, "label": "99기 검증미납", "is_paid_for_board": False},
        {"id": other_once.id, "label": "99기 검증다른행사", "is_paid_for_board": False},
        {"id": all_paid.id, "label": "99기 검증전체", "is_paid_for_board": True},
    ]


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
        db.add_all(
            [
                DuesPayment(roster_member_id=first_id, scope="ALL"),
                DuesPayment(
                    roster_member_id=second_id,
                    scope="ONCE",
                    once_board_id=board_id,
                ),
            ]
        )
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


def test_payment_removal_keeps_activity_participant_snapshot_and_roster_link(api) -> None:
    board_id = _activity_board(api)
    first_id, _ = _seed_payers(api)
    with api.session() as db:
        db.add(DuesPayment(roster_member_id=first_id, scope="ALL"))
        db.commit()
    created = api.client.post(
        f"/api/boards/{board_id}/posts",
        json=_payload([first_id]),
        headers=api.headers["owner"],
    )

    reset = api.client.put(
        f"/api/dues-payers/admin/payments/{first_id}",
        json={"payment_scope": "UNPAID", "once_board_id": None},
        headers=api.headers["admin"],
    )

    assert created.status_code == 200
    assert reset.status_code == 200
    with api.session() as db:
        post = db.get(Post, created.json()["data"]["id"])
        assert post.metadata_json["participants"] == "74기 홍길동"
        assert post.metadata_json["participant_dues_payer_ids"] == [first_id]
        payer = db.get(StudentRosterMember, first_id)
        assert payer is not None
        assert db.scalar(
            select(DuesPayment).where(DuesPayment.roster_member_id == first_id)
        ) is None


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


def test_detail_keeps_payment_state_from_when_the_post_was_written(api) -> None:
    """지원금은 활동 당시 기준이라, 나중에 납부해도 지난 글의 표시는 그대로여야 한다."""
    board_id = _activity_board(api, slug="snapshot-activity-dues-test")
    first_id, _ = _seed_payers(api)
    created = api.client.post(
        f"/api/boards/{board_id}/posts",
        json=_payload([first_id]),
        headers=api.headers["owner"],
    )
    assert created.status_code == 200
    post_id = created.json()["data"]["id"]

    before = api.client.get(f"/api/posts/{post_id}", headers=api.headers["owner"])
    assert before.json()["data"]["activity_participants"][0]["is_paid_for_board"] is False

    # 글을 쓴 뒤에 원우회비를 납부한다.
    with api.session() as db:
        db.add(DuesPayment(roster_member_id=first_id, scope="ALL"))
        db.commit()

    after = api.client.get(f"/api/posts/{post_id}", headers=api.headers["owner"])
    assert after.json()["data"]["activity_participants"][0]["is_paid_for_board"] is False


def test_editing_other_fields_keeps_the_written_payment_state(api) -> None:
    board_id = _activity_board(api, slug="snapshot-edit-activity-dues-test")
    first_id, _ = _seed_payers(api)
    created = api.client.post(
        f"/api/boards/{board_id}/posts",
        json=_payload([first_id]),
        headers=api.headers["owner"],
    )
    assert created.status_code == 200
    post_id = created.json()["data"]["id"]

    with api.session() as db:
        db.add(DuesPayment(roster_member_id=first_id, scope="ALL"))
        db.commit()

    # 참가자는 그대로 두고 다른 칸만 고친다. 앱은 이때 payer_ids를 보내지 않는다.
    edited = api.client.put(
        f"/api/posts/{post_id}",
        json={
            "title": "제목만 고침",
            "content": "소감만 고침",
            "category": "테스트 활동",
            "metadata": {
                "activity_date": "2026.08.12",
                "participants": "74기 홍길동",
            },
            "attachment_ids": [1],
            "is_anonymous": False,
        },
        headers=api.headers["owner"],
    )
    assert edited.status_code == 200

    detail = api.client.get(f"/api/posts/{post_id}", headers=api.headers["owner"])
    assert detail.json()["data"]["activity_participants"][0]["is_paid_for_board"] is False


def test_reselecting_participants_refreshes_the_payment_state(api) -> None:
    board_id = _activity_board(api, slug="snapshot-reselect-activity-dues-test")
    first_id, second_id = _seed_payers(api)
    created = api.client.post(
        f"/api/boards/{board_id}/posts",
        json=_payload([first_id]),
        headers=api.headers["owner"],
    )
    assert created.status_code == 200
    post_id = created.json()["data"]["id"]

    with api.session() as db:
        db.add(DuesPayment(roster_member_id=first_id, scope="ALL"))
        db.commit()

    # 참가자를 다시 고르면 그 시점 기준으로 다시 굳힌다.
    edited = api.client.put(
        f"/api/posts/{post_id}",
        json={
            "title": "참가자 변경",
            "content": "소감",
            "category": "테스트 활동",
            "metadata": {
                "activity_date": "2026.08.12",
                "participants": "무시되는 이름",
                "participant_dues_payer_ids": [first_id, second_id],
            },
            "attachment_ids": [1],
            "is_anonymous": False,
        },
        headers=api.headers["owner"],
    )
    assert edited.status_code == 200

    detail = api.client.get(f"/api/posts/{post_id}", headers=api.headers["owner"])
    states = [item["is_paid_for_board"] for item in detail.json()["data"]["activity_participants"]]
    assert states == [True, False]


def test_posts_written_before_the_snapshot_report_unknown_and_stay_fixed(api) -> None:
    """당시 납부 상태를 알 방법이 없으므로 '모름'으로 두고 화면에서 검은색으로 굳힌다."""
    board_id = _activity_board(api, slug="snapshot-legacy-activity-dues-test")
    first_id, _ = _seed_payers(api)
    created = api.client.post(
        f"/api/boards/{board_id}/posts",
        json=_payload([first_id]),
        headers=api.headers["owner"],
    )
    assert created.status_code == 200
    post_id = created.json()["data"]["id"]

    with api.session() as db:
        post = db.get(Post, post_id)
        metadata = dict(post.metadata_json)
        del metadata["participant_dues_paid"]
        post.metadata_json = metadata
        db.commit()

    before = api.client.get(f"/api/posts/{post_id}", headers=api.headers["owner"])
    assert before.json()["data"]["activity_participants"][0]["is_paid_for_board"] is None

    # 납부 상태를 바꿔도 스냅샷 없는 글의 표시는 그대로여야 한다.
    with api.session() as db:
        db.add(DuesPayment(roster_member_id=first_id, scope="ALL"))
        db.commit()

    after = api.client.get(f"/api/posts/{post_id}", headers=api.headers["owner"])
    assert after.json()["data"]["activity_participants"][0]["is_paid_for_board"] is None
