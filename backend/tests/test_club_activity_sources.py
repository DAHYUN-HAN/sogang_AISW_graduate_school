from datetime import datetime

import pytest

from app.models.board import Board
from app.models.media import PostAttachment
from app.models.post import Post
from app.models.student_roster import StudentRosterMember


def _setup_club_sources(api) -> dict[str, int]:
    with api.session() as db:
        payer = StudentRosterMember(name="Club payer", major="AI", student_number="A74001")
        promo_board = Board(
            name="Club Promotion",
            slug="club-promo",
            category="club",
            board_type="post",
            read_permission="user",
            write_permission="admin",
        )
        activity_board = Board(
            name="Club Activity Certification",
            slug="club-activity",
            category="participation",
            board_type="activity_certification",
            read_permission="user",
            write_permission="user",
        )
        wrong_board = Board(
            name="General Source",
            slug="club-source-wrong-board",
            category="community",
            board_type="post",
            read_permission="user",
            write_permission="user",
        )
        db.add_all([payer, promo_board, activity_board, wrong_board])
        db.flush()

        published = Post(
            board_id=promo_board.id,
            author_id=3,
            title="SG_LLM",
            content="Official club",
            status="published",
        )
        hidden = Post(
            board_id=promo_board.id,
            author_id=3,
            title="Hidden club",
            content="Not selectable",
            status="hidden",
        )
        deleted = Post(
            board_id=promo_board.id,
            author_id=3,
            title="Retired club",
            content="Historical only",
            status="published",
            deleted_at=datetime.utcnow(),
        )
        wrong_board_post = Post(
            board_id=wrong_board.id,
            author_id=1,
            title="Not a club source",
            content="Wrong board",
            status="published",
        )
        db.add_all([published, hidden, deleted, wrong_board_post])
        db.commit()
        return {
            "payer": payer.id,
            "promo_board": promo_board.id,
            "activity_board": activity_board.id,
            "published": published.id,
            "hidden": hidden.id,
            "deleted": deleted.id,
            "wrong_board": wrong_board_post.id,
        }


def _create_payload(payer_id: int, source_id: object = None) -> dict:
    metadata: dict[str, object] = {
        "activity_date": "2026.08.14",
        "participant_dues_payer_ids": [payer_id],
        "bank_account": "Sogang 123",
    }
    if source_id is not None:
        metadata["activity_source_post_id"] = source_id
    return {
        "title": "Client activity title",
        "content": "Activity reflection",
        "category": "Client supplied club",
        "metadata": metadata,
        "attachment_ids": [1],
        "is_anonymous": False,
    }


def test_club_activity_create_uses_the_admin_source_title(api) -> None:
    source = _setup_club_sources(api)

    response = api.client.post(
        f"/api/boards/{source['activity_board']}/posts",
        headers=api.headers["owner"],
        json=_create_payload(source["payer"], str(source["published"])),
    )

    assert response.status_code == 200
    with api.session() as db:
        post = db.get(Post, response.json()["data"]["id"])
        assert post is not None
        assert post.category == "SG_LLM"
        assert post.metadata_json is not None
        assert post.metadata_json["activity_source_post_id"] == str(source["published"])


def test_admin_created_club_is_selectable_and_can_be_used_by_a_member(api) -> None:
    source = _setup_club_sources(api)
    guide_payload = {
        "title": "파인튜닝 (커피)",
        "content": "관리자가 등록한 신규 동아리",
        "metadata": {"application_url": "https://example.com/coffee-club"},
        "attachment_ids": [1],
    }
    guide_response = api.client.post(
        f"/api/boards/{source['promo_board']}/posts",
        headers=api.headers["admin"],
        json=guide_payload,
    )
    assert guide_response.status_code == 200
    guide_id = guide_response.json()["data"]["id"]

    for role in ("owner", "admin"):
        options_response = api.client.get(
            f"/api/boards/{source['promo_board']}/posts",
            headers=api.headers[role],
            params={"status": "published", "sort": "latest"},
        )
        assert options_response.status_code == 200
        options = {post["id"]: post["title"] for post in options_response.json()["data"]}
        assert options[guide_id] == "파인튜닝 (커피)"
        assert source["hidden"] not in options
        assert source["deleted"] not in options

    response = api.client.post(
        f"/api/boards/{source['activity_board']}/posts",
        headers=api.headers["owner"],
        json=_create_payload(source["payer"], str(guide_id)),
    )
    assert response.status_code == 200
    activity_id = response.json()["data"]["id"]
    detail = api.client.get(f"/api/posts/{activity_id}", headers=api.headers["owner"])
    assert detail.status_code == 200
    assert detail.json()["data"]["category"] == "파인튜닝 (커피)"
    assert detail.json()["data"]["activity_source_title"] == "파인튜닝 (커피)"
    assert detail.json()["data"]["metadata"]["activity_source_post_id"] == str(guide_id)

    rename = api.client.put(
        f"/api/posts/{guide_id}",
        headers=api.headers["admin"],
        json={**guide_payload, "title": "파인튜닝 커피 연구회"},
    )
    assert rename.status_code == 200
    renamed_detail = api.client.get(f"/api/posts/{activity_id}", headers=api.headers["owner"])
    assert renamed_detail.json()["data"]["activity_source_title"] == "파인튜닝 커피 연구회"


def test_club_activity_create_rejects_missing_malformed_or_inactive_sources(api) -> None:
    source = _setup_club_sources(api)
    invalid_sources = [
        None,
        "not-a-number",
        str(source["hidden"]),
        str(source["deleted"]),
        str(source["wrong_board"]),
        "999999",
    ]

    for invalid_source in invalid_sources:
        response = api.client.post(
            f"/api/boards/{source['activity_board']}/posts",
            headers=api.headers["owner"],
            json=_create_payload(source["payer"], invalid_source),
        )
        assert response.status_code == 422, invalid_source
        assert response.json()["code"] == "INVALID_ACTIVITY_SOURCE"


def test_club_activity_reads_current_title_and_keeps_retired_history(api) -> None:
    source = _setup_club_sources(api)
    with api.session() as db:
        linked = Post(
            board_id=source["activity_board"],
            author_id=1,
            title="Linked activity",
            content="Linked reflection",
            category="Old club snapshot",
            metadata_json={
                "activity_date": "2026.08.14",
                "participants": "Club payer",
                "participant_dues_payer_ids": [source["payer"]],
                "activity_source_post_id": str(source["published"]),
                "bank_account": "Sogang 123",
            },
        )
        wrong_link = Post(
            board_id=source["activity_board"],
            author_id=1,
            title="Wrong link activity",
            content="Wrong link reflection",
            category="Legacy fallback",
            metadata_json={
                "activity_date": "2026.08.14",
                "participants": "Club payer",
                "participant_dues_payer_ids": [source["payer"]],
                "activity_source_post_id": str(source["wrong_board"]),
                "bank_account": "Sogang 123",
            },
        )
        db.add_all([linked, wrong_link])
        db.flush()
        db.add(PostAttachment(post_id=linked.id, media_id=1, sort_order=0))
        linked_id = linked.id
        wrong_link_id = wrong_link.id

        club_source = db.get(Post, source["published"])
        assert club_source is not None
        club_source.title = "SG AI Lab"
        club_source.deleted_at = datetime.utcnow()
        db.commit()

    list_response = api.client.get(
        f"/api/boards/{source['activity_board']}/posts",
        headers=api.headers["owner"],
    )
    detail_response = api.client.get(f"/api/posts/{linked_id}", headers=api.headers["owner"])

    assert list_response.status_code == 200
    items = {item["id"]: item for item in list_response.json()["data"]}
    assert items[linked_id]["activity_source_title"] == "SG AI Lab"
    assert items[wrong_link_id]["activity_source_title"] is None
    assert detail_response.status_code == 200
    assert detail_response.json()["data"]["activity_source_title"] == "SG AI Lab"

    update_response = api.client.put(
        f"/api/posts/{linked_id}",
        headers=api.headers["owner"],
        json={
            **_create_payload(source["payer"], str(source["published"])),
            "content": "Updated historical reflection",
        },
    )
    assert update_response.status_code == 200
    with api.session() as db:
        linked = db.get(Post, linked_id)
        assert linked is not None
        assert linked.category == "SG AI Lab"


def test_club_operation_end_blocks_new_certifications_but_preserves_existing_edits(api) -> None:
    source = _setup_club_sources(api)
    guide_payload = {
        "title": "파인튜닝 (커피)", "content": "운영 상태 검증",
        "category": "마감", "attachment_ids": [1],
        "metadata": {"application_url": "https://example.com/join", "club_operation_status": "active"},
    }
    guide = api.client.post(f"/api/boards/{source['promo_board']}/posts", headers=api.headers["admin"], json=guide_payload)
    assert guide.status_code == 200
    guide_id = guide.json()["data"]["id"]
    activity_payload = _create_payload(source["payer"], str(guide_id))
    created = api.client.post(f"/api/boards/{source['activity_board']}/posts", headers=api.headers["owner"], json=activity_payload)
    assert created.status_code == 200, "Recruitment closure does not end club operations"
    activity_id = created.json()["data"]["id"]

    ended = api.client.put(f"/api/posts/{guide_id}", headers=api.headers["admin"], json={
        **guide_payload, "metadata": {**guide_payload["metadata"], "club_operation_status": "ended"},
    })
    assert ended.status_code == 200
    rejected = api.client.post(f"/api/boards/{source['activity_board']}/posts", headers=api.headers["owner"], json=activity_payload)
    assert rejected.status_code == 422
    assert rejected.json()["code"] == "INVALID_ACTIVITY_SOURCE"
    edited = api.client.put(f"/api/posts/{activity_id}", headers=api.headers["owner"], json={**activity_payload, "content": "과거 인증 내용 수정"})
    assert edited.status_code == 200

    legacy_edit = api.client.put(f"/api/posts/{guide_id}", headers=api.headers["admin"], json={
        **guide_payload, "metadata": {"application_url": "https://example.com/updated"},
    })
    assert legacy_edit.status_code == 200
    detail = api.client.get(f"/api/posts/{guide_id}", headers=api.headers["owner"])
    assert detail.json()["data"]["metadata"]["club_operation_status"] == "ended"

    resumed = api.client.put(f"/api/posts/{guide_id}", headers=api.headers["admin"], json=guide_payload)
    assert resumed.status_code == 200
    reopened = api.client.post(f"/api/boards/{source['activity_board']}/posts", headers=api.headers["owner"], json=activity_payload)
    assert reopened.status_code == 200


@pytest.mark.parametrize("invalid_status", ["closed", "", None, True, {}])
def test_club_operation_status_rejects_invalid_values(api, invalid_status) -> None:
    source = _setup_club_sources(api)
    response = api.client.post(f"/api/boards/{source['promo_board']}/posts", headers=api.headers["admin"], json={
        "title": "Club", "content": "Invalid operation status", "attachment_ids": [1],
        "metadata": {"application_url": "https://example.com/join", "club_operation_status": invalid_status},
    })
    assert response.status_code == 422
    assert response.json()["code"] == "INVALID_CLUB_OPERATION_STATUS"
