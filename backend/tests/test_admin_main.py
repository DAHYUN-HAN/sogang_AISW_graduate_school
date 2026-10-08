from datetime import date, datetime

from sqlalchemy import select

from app.models.board import Board
from app.models.comment import Comment
from app.models.post import Post
from app.models.post_extension import PostMutualAid, PostSuggestion
from app.routers import admin

NOW = datetime(2026, 10, 7, 2, 30)


def prepare(api, monkeypatch):
    monkeypatch.setattr(admin, "utc_now", lambda: NOW)
    with api.session() as db:
        for post in db.scalars(select(Post)):
            post.created_at = datetime(2026, 9, 1)
        for comment in db.scalars(select(Comment)):
            comment.created_at = datetime(2026, 9, 1)
        db.commit()


def request_post(db, *, kind="mutual_aid", status="processing", handled=None, created=None, hidden=False):
    board = db.scalar(select(Board).where(Board.board_type == kind))
    if board is None:
        board = Board(name="Suggestions", slug="suggestions", category="council", board_type=kind)
        db.add(board)
        db.flush()
    post = Post(board_id=board.id, author_id=1, title=f"Request {status}", content="Body",
                created_at=created or datetime(2026, 9, 2), status="hidden" if hidden else "published")
    db.add(post)
    db.flush()
    if kind == "mutual_aid":
        db.add(PostMutualAid(post_id=post.id, event_type="wedding", event_date=date(2026, 10, 8),
                             relation="self", status=status, reviewed_at=handled))
    else:
        db.add(PostSuggestion(post_id=post.id, status=status, replied_at=handled, admin_reply="Official"))
    return post.id


def test_main_is_admin_only(api):
    assert api.client.get("/api/admin/main").status_code == 401
    assert api.client.get("/api/admin/main", headers=api.headers["owner"]).status_code == 403
    assert api.client.get("/api/admin/main", headers=api.headers["admin"]).status_code == 200


def test_main_filters_before_pagination_and_counts_all_pending(api, monkeypatch):
    prepare(api, monkeypatch)
    with api.session() as db:
        db.get(Post, 2).deleted_at = NOW
        old_pending = 1
        newest_pending = request_post(db, created=datetime(2026, 10, 6, 23))
        today_done = request_post(db, status="completed", handled=datetime(2026, 10, 6, 15))
        today_rejected = request_post(db, status="rejected", handled=datetime(2026, 10, 7, 1))
        request_post(db, status="completed", handled=datetime(2026, 10, 6, 14, 59, 59))
        request_post(db, status="completed")
        request_post(db, hidden=True)
        request_post(db, status="completed", handled=datetime(2026, 10, 7, 15))
        db.commit()
    first = api.client.get("/api/admin/main?size=2", headers=api.headers["admin"]).json()["data"]
    queue = first["mutual_aid"]
    assert queue["pending_count"] == 2
    assert queue["today_handled_count"] == 2
    assert queue["total"] == 4 and queue["total_pages"] == 2
    assert [item["id"] for item in queue["items"]] == [newest_pending, old_pending]
    second = api.client.get("/api/admin/main?size=2&mutual_page=2", headers=api.headers["admin"]).json()["data"]
    assert [item["id"] for item in second["mutual_aid"]["items"]] == [today_rejected, today_done]


def test_suggestion_queue_uses_reply_date_and_anonymous_display(api, monkeypatch):
    prepare(api, monkeypatch)
    with api.session() as db:
        pending = request_post(db, kind="suggestion", status="received")
        done = request_post(db, kind="suggestion", status="answered", handled=datetime(2026, 10, 6, 15))
        request_post(db, kind="suggestion", status="answered", handled=datetime(2026, 10, 6, 14, 59, 59))
        request_post(db, kind="suggestion", status="answered")
        db.commit()
    data = api.client.get("/api/admin/main", headers=api.headers["admin"]).json()["data"]
    assert data["date"] == "2026-10-07"
    assert [item["id"] for item in data["suggestions"]["items"]] == [pending, done]
    assert all(item["author_label"] == "익명" for item in data["suggestions"]["items"])
    assert "content" not in data["suggestions"]["items"][0]


def test_daily_metrics_use_kst_ranges_and_include_replies(api, monkeypatch):
    prepare(api, monkeypatch)
    with api.session() as db:
        db.get(Post, 1).created_at = datetime(2026, 10, 6, 15)
        db.get(Post, 2).created_at = datetime(2026, 10, 6, 14, 59, 59)
        db.get(Post, 3).created_at = datetime(2026, 10, 7, 2)
        db.get(Post, 4).created_at = datetime(2026, 10, 7, 1)  # hidden
        db.get(Post, 5).created_at = datetime(2026, 10, 7, 1)  # draft
        first = db.get(Comment, 1)
        first.created_at = datetime(2026, 10, 6, 15)
        db.add(Comment(post_id=1, author_id=2, parent_id=first.id, content="Reply", created_at=datetime(2026, 10, 7, 2)))
        db.add(Comment(post_id=3, author_id=2, content="Yesterday", created_at=datetime(2026, 10, 6, 14, 59, 59)))
        db.commit()
    metrics = api.client.get("/api/admin/main", headers=api.headers["admin"]).json()["data"]["metrics"]
    assert metrics["posts_today"] == 2
    assert metrics["posts_yesterday"] == 1
    assert metrics["comments_today"] == 2
    assert metrics["comments_yesterday"] == 1


def test_kst_midnight_drops_handled_records_but_retains_pending(api, monkeypatch):
    prepare(api, monkeypatch)
    with api.session() as db:
        request_post(db, status="completed", handled=datetime(2026, 10, 7, 14, 59, 59))
        db.commit()
    monkeypatch.setattr(admin, "utc_now", lambda: datetime(2026, 10, 7, 15))
    queue = api.client.get("/api/admin/main", headers=api.headers["admin"]).json()["data"]["mutual_aid"]
    assert queue["pending_count"] == 2
    assert queue["today_handled_count"] == 0

