from datetime import datetime

from sqlalchemy import select

from app.models.audit import OperationalAuditLog
from app.models.board import Board
from app.models.post_extension import PostMutualAid


def logs(api):
    return api.client.get("/api/admin/audit-logs", headers=api.headers["admin"]).json()["data"]


def test_admin_post_create_update_logs_once_and_ignores_noop_or_invalid(api):
    body = {"title": "Admin notice body", "content": "Original"}
    created = api.client.post("/api/boards/2/posts", json=body, headers=api.headers["admin"])
    post_id = created.json()["data"]["id"]
    assert logs(api)[0]["action"] == "post.create"
    assert logs(api)[0]["details"]["title"] == body["title"]
    updated = {**body, "content": "Changed"}
    assert api.client.put(f"/api/posts/{post_id}", json=updated, headers=api.headers["admin"]).status_code == 200
    assert logs(api)[0]["action"] == "post.update"
    assert logs(api)[0]["details"]["changed_fields"] == ["content"]
    assert "Changed" not in str(logs(api)[0]["details"])
    api.client.put(f"/api/posts/{post_id}", json=updated, headers=api.headers["admin"])
    api.client.put(f"/api/posts/{post_id}", json={"title": ""}, headers=api.headers["admin"])
    assert len(logs(api)) == 2


def test_member_post_does_not_create_admin_record(api):
    api.client.post("/api/boards/2/posts", json={"title": "Member", "content": "Content"}, headers=api.headers["owner"])
    assert logs(api) == []


def test_admin_notice_has_one_record_and_keeps_target_after_deletion(api):
    with api.session() as db:
        board = Board(name="Notices", slug="notices-audit", category="notices", board_type="notice", write_permission="admin")
        db.add(board); db.commit(); board_id = board.id
    response = api.client.post(f"/api/boards/{board_id}/posts", json={"title": "Notice", "content": "Body"}, headers=api.headers["admin"])
    assert response.status_code == 200
    post_id = response.json()["data"]["id"]
    assert len(logs(api)) == 1 and logs(api)[0]["action"] == "notice.create"
    api.client.delete(f"/api/posts/{post_id}", headers=api.headers["admin"])
    assert logs(api)[0]["details"]["title"] == "Notice"


def test_admin_comment_writes_and_controls_are_recorded_without_body(api):
    result = api.client.post("/api/posts/3/comments", json={"content": "Secret reply text"}, headers=api.headers["admin"])
    comment_id = result.json()["data"]["id"]
    api.client.put(f"/api/comments/{comment_id}", json={"content": "Edited secret"}, headers=api.headers["admin"])
    api.client.put(f"/api/comments/{comment_id}", json={"content": "Edited secret"}, headers=api.headers["admin"])
    api.client.delete(f"/api/comments/{comment_id}", headers=api.headers["admin"])
    rows = logs(api)
    assert [row["action"] for row in rows] == ["comment.delete", "comment.update", "comment.create"]
    assert "secret" not in str(rows).lower()


def test_noop_mutual_aid_save_does_not_move_handling_date_or_log(api):
    original = datetime(2026, 10, 6, 1)
    with api.session() as db:
        extension = db.scalar(select(PostMutualAid).where(PostMutualAid.post_id == 1))
        extension.status = "completed"; extension.reviewed_at = original
        db.commit()
    assert api.client.put("/api/posts/1/mutual-aid", json={"status": "completed"}, headers=api.headers["admin"]).status_code == 200
    with api.session() as db:
        assert db.scalar(select(PostMutualAid).where(PostMutualAid.post_id == 1)).reviewed_at == original
        assert db.scalar(select(OperationalAuditLog)) is None

