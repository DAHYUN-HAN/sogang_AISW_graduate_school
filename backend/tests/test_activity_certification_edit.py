import pytest

from app.models.board import Board
from app.models.media import PostAttachment
from app.models.post import Post
from app.models.student_roster import StudentRosterMember


def _create_activity_certification(api, slug="club-activity-edit-test") -> tuple[int, int]:
    with api.session() as db:
        db.add_all(
            [
                StudentRosterMember(name="Owner payer", major="AI", student_number="A74001"),
                StudentRosterMember(name="Other payer", major="Security", student_number="A74002"),
            ]
        )
        board = Board(
            name="Club Activity Certification",
            slug=slug,
            category="participation",
            board_type="activity_certification",
            read_permission="user",
            write_permission="user",
        )
        db.add(board)
        db.flush()
        post = Post(
            board_id=board.id,
            author_id=1,
            title="Original activity",
            content="Original reflection",
            category="Original club",
            metadata_json={
                "activity_date": "2026.07.01",
                "participants": "Owner",
                "participant_user_ids": "1",
                "activity_source_post_id": "3",
                "bank_account": "Sogang Bank 123-456",
            },
        )
        db.add(post)
        db.flush()
        db.add(PostAttachment(post_id=post.id, media_id=1, sort_order=0))
        db.commit()
        return board.id, post.id


def _update_payload() -> dict:
    return {
        "title": "Updated activity",
        "content": "Updated reflection",
        "category": "Updated club",
        "metadata": {
            "activity_date": "2026.08.15",
            "participants": "client supplied names",
            "participant_dues_payer_ids": [1, 2],
            "activity_source_post_id": "3",
        },
        "attachment_ids": [1],
        "is_anonymous": False,
    }


def test_activity_certification_owner_updates_date_and_participants_without_losing_bank_account(api) -> None:
    board_id, post_id = _create_activity_certification(api)

    member_list = api.client.get(f"/api/boards/{board_id}/posts", headers=api.headers["owner"])
    member_detail = api.client.get(f"/api/posts/{post_id}", headers=api.headers["owner"])
    admin_detail = api.client.get(f"/api/posts/{post_id}", headers=api.headers["admin"])
    admin_list = api.client.get(
        "/api/posts/admin/all",
        params={"board_id": board_id},
        headers=api.headers["admin"],
    )
    forbidden_admin_list = api.client.get(
        "/api/posts/admin/all",
        params={"board_id": board_id},
        headers=api.headers["owner"],
    )
    forbidden = api.client.put(
        f"/api/posts/{post_id}",
        json=_update_payload(),
        headers=api.headers["other"],
    )

    assert member_list.status_code == 200
    assert "bank_account" not in member_list.json()["data"][0]["metadata"]
    assert member_detail.status_code == 200
    assert "bank_account" not in member_detail.json()["data"]["metadata"]
    assert admin_detail.status_code == 200
    assert admin_detail.json()["data"]["metadata"]["bank_account"] == "Sogang Bank 123-456"
    assert admin_list.status_code == 200
    assert admin_list.json()["data"][0]["metadata"]["bank_account"] == "Sogang Bank 123-456"
    assert forbidden_admin_list.status_code == 403
    assert forbidden.status_code == 403

    response = api.client.put(
        f"/api/posts/{post_id}",
        json=_update_payload(),
        headers=api.headers["owner"],
    )

    assert response.status_code == 200
    assert response.json() == {"status": "success", "data": {"id": post_id}}
    with api.session() as db:
        post = db.get(Post, post_id)
        assert post.metadata_json == {
            "activity_date": "2026.08.15",
            "participants": "74기 Owner payer, 74기 Other payer",
            "participant_dues_payer_ids": [1, 2],
            # 참가자를 다시 고른 시점의 납부 여부를 굳혀 둔다. 둘 다 납부 기록이 없다.
            "participant_dues_paid": [False, False],
            "activity_source_post_id": "3",
            "bank_account": "Sogang Bank 123-456",
        }
        attachments = db.query(PostAttachment).filter(PostAttachment.post_id == post_id).all()
        assert [attachment.media_id for attachment in attachments] == [1]


@pytest.mark.parametrize("slug", ["club-activity-edit-test", "study-activity", "networking-activity"])
def test_saved_activity_account_is_available_only_in_authorized_edit_context(api, slug) -> None:
    board_id, post_id = _create_activity_certification(api, slug)
    with api.session() as db:
        post = db.get(Post, post_id)
        post.metadata_json = {**post.metadata_json, "legacy_original_title": "Private migration snapshot"}
        db.commit()

    for actor in ("owner", "admin"):
        response = api.client.get(f"/api/posts/{post_id}?for_edit=true", headers=api.headers[actor])
        assert response.status_code == 200
        assert response.json()["data"]["metadata"]["bank_account"] == "Sogang Bank 123-456"
        if actor == "owner" and slug == "study-activity":
            assert "legacy_original_title" not in response.json()["data"]["metadata"]

    assert api.client.get(f"/api/posts/{post_id}?for_edit=true", headers=api.headers["other"]).status_code == 403
    assert api.client.get(f"/api/posts/{post_id}?for_edit=true").status_code == 401
    for actor in ("owner", "other"):
        for path in (f"/api/posts/{post_id}", f"/api/boards/{board_id}/posts"):
            response = api.client.get(path, headers=api.headers[actor])
            assert response.status_code == 200
            data = response.json()["data"]
            post_data = data[0] if isinstance(data, list) else data
            assert "bank_account" not in post_data["metadata"]


def test_activity_certification_owner_replaces_bank_account_and_reopens_it(api) -> None:
    _, post_id = _create_activity_certification(api)
    payload = _update_payload()
    payload["metadata"]["bank_account"] = "Replacement Bank 999-000"

    response = api.client.put(
        f"/api/posts/{post_id}",
        json=payload,
        headers=api.headers["owner"],
    )

    assert response.status_code == 200
    with api.session() as db:
        post = db.get(Post, post_id)
        assert post.metadata_json["bank_account"] == "Replacement Bank 999-000"
    reopened = api.client.get(f"/api/posts/{post_id}?for_edit=true", headers=api.headers["owner"])
    assert reopened.status_code == 200
    assert reopened.json()["data"]["metadata"]["bank_account"] == "Replacement Bank 999-000"
