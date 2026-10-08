from sqlalchemy import select
from app.models.board import Board
from app.models.post import Post


def create_board(api, slug, *, parent=None, section="resources", category="resources"):
    return api.client.post("/api/boards/admin", headers=api.headers["admin"], json={
        "name": slug, "slug": slug, "category": category, "board_type": "resource",
        "metadata": {"admin_navigation": {"section": section, "parent_board_id": parent}},
    })


def test_invalid_parent_and_cycle_are_rejected(api):
    bad = create_board(api, "bad-parent", parent=9999)
    assert bad.status_code == 422
    root = create_board(api, "root").json()["data"]
    child = create_board(api, "child", parent=root["id"]).json()["data"]
    response = api.client.put(f'/api/boards/admin/{root["id"]}', headers=api.headers["admin"], json={
        "metadata": {"admin_navigation": {"section": "resources", "parent_board_id": child["id"]}},
    })
    assert response.status_code == 422


def test_remove_hides_descendants_preserves_content_and_supports_restore(api):
    root = create_board(api, "root").json()["data"]
    child = create_board(api, "child", parent=root["id"]).json()["data"]
    with api.session() as db:
        db.add(Post(board_id=child["id"], author_id=1, title="Keep", content="Keep", status="published"))
        db.commit()
    removed = api.client.delete(f'/api/boards/admin/{root["id"]}', headers=api.headers["admin"])
    assert removed.status_code == 200
    with api.session() as db:
        assert db.get(Board, root["id"]).is_active is False
        assert db.get(Board, child["id"]).is_active is False
        assert db.scalar(select(Post).where(Post.title == "Keep")) is not None
    forbidden_restore = api.client.put(f'/api/boards/admin/{child["id"]}', headers=api.headers["admin"], json={"is_active": True})
    assert forbidden_restore.status_code == 422
    assert api.client.put(f'/api/boards/admin/{root["id"]}', headers=api.headers["admin"], json={"is_active": True}).status_code == 200
    assert api.client.put(f'/api/boards/admin/{child["id"]}', headers=api.headers["admin"], json={"is_active": True}).status_code == 200


def test_member_cannot_remove_board(api):
    response = api.client.delete("/api/boards/admin/2", headers=api.headers["owner"])
    assert response.status_code == 403


def test_settings_deactivation_also_hides_children(api):
    root = create_board(api, "root").json()["data"]
    child = create_board(api, "child", parent=root["id"]).json()["data"]
    response = api.client.put(f'/api/boards/admin/{root["id"]}', headers=api.headers["admin"], json={"is_active": False})
    assert response.status_code == 200
    with api.session() as db:
        assert db.get(Board, child["id"]).is_active is False


def test_navigation_rejects_non_string_section(api):
    response = api.client.post("/api/boards/admin", headers=api.headers["admin"], json={
        "name": "Bad", "slug": "bad", "category": "resources",
        "metadata": {"admin_navigation": {"section": ["resources"]}},
    })
    assert response.status_code == 422


def test_group_and_notice_filters_apply_before_pagination(api):
    with api.session() as db:
        academic = Board(name="Academic", slug="academic-notices", category="notices", board_type="notice")
        webinar = Board(name="Webinar", slug="webinar-notices", category="notices", board_type="notice")
        db.add_all([academic, webinar])
        db.flush()
        academic_id, webinar_id = academic.id, webinar.id
        db.add_all([Post(board_id=academic.id, author_id=1, title="Academic", content="Content", status="published"),
                    Post(board_id=webinar.id, author_id=1, title="Webinar", content="Content", status="published")])
        db.commit()
    result = api.client.get("/api/posts/admin/all", headers=api.headers["admin"], params={
        "board_ids": f"{academic_id},{webinar_id}", "notice_category": "event", "size": 1,
    }).json()
    assert [row["title"] for row in result["data"]] == ["Webinar"]
    assert result["pagination"]["total"] == 1
