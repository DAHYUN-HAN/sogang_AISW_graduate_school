from datetime import datetime, timezone
from uuid import uuid4

import pytest
from sqlalchemy import select

from app.config import settings
from app.models.board import Board
from app.models.comment import Comment
from app.models.post import Post
from app.models.usage import UsagePageView
from app.models.user import User
from app.routers import admin

NOW = datetime(2026, 10, 7, 2, 30)


@pytest.fixture
def dashboard(api, monkeypatch):
    monkeypatch.setattr(admin, "utc_now", lambda: NOW)
    monkeypatch.setattr(settings, "usage_tracking_enabled", True)
    with api.session() as db:
        for post in db.scalars(select(Post)):
            post.created_at = datetime(2026, 9, 1)
        for comment in db.scalars(select(Comment)):
            comment.created_at = datetime(2026, 9, 1)
        db.get(User, 1).cohort = "72"
        db.commit()
    return api


def get_dashboard(api, query=""):
    response = api.client.get(f"/api/admin/dashboard{query}", headers=api.headers["admin"])
    assert response.status_code == 200, response.text
    assert response.json()["status"] == "success"
    return response.json()["data"]


def add_view(db, created_at, *, visitor="a", session="first"):
    db.add(UsagePageView(
        event_id=str(uuid4()), visitor_key=visitor * 64, device_id=str(uuid4()),
        session_id=session, screen="home", created_at=created_at,
    ))


def test_dashboard_rejects_guests_and_members(api):
    guest = api.client.get("/api/admin/dashboard")
    member = api.client.get("/api/admin/dashboard", headers=api.headers["owner"])
    assert guest.status_code == 401
    assert guest.json()["code"] == "UNAUTHORIZED"
    assert member.status_code == 403
    assert member.json()["code"] == "FORBIDDEN"
    assert api.client.get("/api/admin/dashboard", headers=api.headers["admin"]).status_code == 200


def test_today_counts_and_details_share_kst_bounds_and_include_retained_replies(dashboard):
    with dashboard.session() as db:
        db.get(Post, 1).created_at = datetime(2026, 10, 6, 15)
        db.get(Post, 2).created_at = datetime(2026, 10, 6, 14, 59, 59)
        db.get(Post, 3).created_at = NOW
        db.get(Post, 4).created_at = datetime(2026, 10, 7, 1)  # hidden
        db.get(Post, 5).created_at = datetime(2026, 10, 7, 1)  # draft
        deleted = Post(board_id=2, author_id=1, title="Deleted", content="Body",
                       created_at=NOW, deleted_at=NOW)
        db.add(deleted)
        db.flush()
        root = db.get(Comment, 1)
        root.created_at = datetime(2026, 10, 6, 15)
        reply = Comment(post_id=1, author_id=2, parent_id=root.id, content="Reply", created_at=NOW)
        hidden = Comment(post_id=4, author_id=2, content="Retained hidden", created_at=NOW)
        removed = Comment(post_id=deleted.id, author_id=2, content="Retained deleted", created_at=NOW)
        db.add_all([reply, hidden, removed,
                    Comment(post_id=3, author_id=2, content="Yesterday", created_at=datetime(2026, 10, 6, 14, 59, 59)),
                    Comment(post_id=3, author_id=2, content="Future", created_at=datetime(2026, 10, 7, 2, 30, 1))])
        db.add(Post(board_id=2, author_id=1, title="Future", content="Body", created_at=datetime(2026, 10, 7, 2, 30, 1)))
        db.flush()
        comment_ids = [removed.id, hidden.id, reply.id, root.id]
        db.commit()
    data = get_dashboard(dashboard)
    assert data["date"] == "2026-10-07"
    assert data["as_of"] == "2026-10-07T02:30:00Z"
    assert data["metrics"]["posts_today"] == data["posts"]["total"] == 2
    assert data["metrics"]["posts_yesterday"] == 1
    assert data["metrics"]["comments_today"] == data["comments"]["total"] == 4
    assert data["metrics"]["comments_yesterday"] == 1
    assert [item["id"] for item in data["posts"]["items"]] == [3, 1]
    assert [item["id"] for item in data["comments"]["items"]] == comment_ids
    assert data["comments"]["items"][0]["post_title"] == "Deleted"


def test_historical_date_covers_full_kst_day_and_uses_previous_day(dashboard):
    with dashboard.session() as db:
        db.get(Post, 1).created_at = datetime(2026, 10, 5, 15)
        db.get(Post, 2).created_at = datetime(2026, 10, 6, 14, 59, 59)
        db.get(Post, 3).created_at = datetime(2026, 10, 6, 15)
        db.add(Post(board_id=2, author_id=1, title="Previous day", content="Body", created_at=datetime(2026, 10, 5, 14, 59, 59)))
        db.get(Comment, 1).created_at = datetime(2026, 10, 6, 14, 59, 59)
        db.commit()
    data = get_dashboard(dashboard, "?date=2026-10-06")
    assert data["date"] == "2026-10-06"
    assert data["metrics"]["posts_today"] == data["posts"]["total"] == 2
    assert data["metrics"]["posts_yesterday"] == 1
    assert data["metrics"]["comments_today"] == data["comments"]["total"] == 1
    assert [item["id"] for item in data["posts"]["items"]] == [2, 1]


def test_pagination_filters_globally_before_offset_and_breaks_ties_by_id(dashboard):
    with dashboard.session() as db:
        post_ids = []
        comment_ids = []
        for index in range(5):
            post = Post(board_id=2, author_id=1, title=f"Post {index}", content="Body", created_at=NOW)
            db.add(post)
            db.flush()
            comment = Comment(post_id=post.id, author_id=1, content=f"Comment {index}", created_at=NOW)
            db.add(comment)
            db.flush()
            post_ids.append(post.id)
            comment_ids.append(comment.id)
        db.get(Post, 4).created_at = NOW  # hidden must not consume an offset
        db.commit()
    data = get_dashboard(dashboard, "?post_page=2&comment_page=3&size=2")
    assert data["posts"]["total"] == data["comments"]["total"] == 5
    assert data["posts"]["total_pages"] == data["comments"]["total_pages"] == 3
    assert data["posts"]["page"] == 2 and data["posts"]["size"] == 2
    assert [item["id"] for item in data["posts"]["items"]] == [post_ids[2], post_ids[1]]
    assert data["comments"]["page"] == 3
    assert [item["id"] for item in data["comments"]["items"]] == [comment_ids[0]]
    empty = get_dashboard(dashboard, "?post_page=99&comment_page=99&size=2")
    assert empty["posts"]["items"] == empty["comments"]["items"] == []
    assert empty["posts"]["total"] == empty["comments"]["total"] == 5


def test_anonymous_and_forced_anonymous_drilldown_never_exposes_identity(dashboard):
    with dashboard.session() as db:
        suggestions = Board(name="Suggestions", slug="suggestions", category="council", board_type="suggestion")
        reviews = Board(name="Reviews", slug="lecture-reviews", category="resources", board_type="resource")
        db.add_all([suggestions, reviews])
        db.flush()
        anonymous = Post(board_id=2, author_id=1, title="Anonymous", content="Body", is_anonymous=True, created_at=NOW)
        forced = Post(board_id=suggestions.id, author_id=1, title="Suggestion", content="Body", created_at=NOW)
        review = Post(board_id=reviews.id, author_id=1, title="Review", content="Body", created_at=NOW)
        historical = Post(board_id=2, author_id=None, author_nickname_snapshot="Former", author_cohort_snapshot="70",
                          title="Historical", content="Body", created_at=NOW,
                          metadata_json={"bank_account": "private account", "proof_url": "private proof"})
        db.add_all([anonymous, forced, review, historical])
        db.flush()
        for post in (anonymous, forced, review):
            db.add(Comment(post_id=post.id, author_id=1, content="Comment", created_at=NOW))
        db.add(Comment(post_id=historical.id, author_id=None, author_nickname_snapshot="Former", author_cohort_snapshot="70",
                       content="Historical comment", created_at=NOW))
        private_ids = {anonymous.id, forced.id, review.id}
        db.commit()
    data = get_dashboard(dashboard)
    for item in data["posts"]["items"]:
        assert set(item) == {"id", "board_id", "board_name", "title", "author_label", "author_cohort", "created_at"}
        if item["id"] in private_ids:
            assert item["author_label"] == "익명" and item["author_cohort"] is None
        else:
            assert item["author_label"] == "Former" and item["author_cohort"] == "70"
    for item in data["comments"]["items"]:
        assert set(item) == {"id", "post_id", "board_id", "post_title", "author_label", "author_cohort", "content", "created_at"}
        if item["post_id"] in private_ids:
            assert item["author_label"] == "익명" and item["author_cohort"] is None
        else:
            assert item["author_label"] == "Former" and item["author_cohort"] == "70"


def test_daily_traffic_trend_has_seven_kst_days_and_null_before_collection(dashboard):
    with dashboard.session() as db:
        add_view(db, datetime(2026, 10, 4, 15))  # first collection: Oct 5 KST
        add_view(db, datetime(2026, 10, 5, 14, 59, 59), session="second")
        add_view(db, datetime(2026, 10, 6, 15), session="today")
        add_view(db, NOW, session="today")  # two page views in one visit
        add_view(db, NOW, visitor="b", session="other")
        add_view(db, datetime(2026, 10, 7, 2, 30, 1), visitor="c", session="future")
        db.commit()
    data = get_dashboard(dashboard)
    assert data["traffic"] == {"status": "collecting", "started_at": "2026-10-04T15:00:00Z"}
    assert data["trend"] == [
        {"date": "2026-10-01", "visits": None, "visitors": None, "page_views": None},
        {"date": "2026-10-02", "visits": None, "visitors": None, "page_views": None},
        {"date": "2026-10-03", "visits": None, "visitors": None, "page_views": None},
        {"date": "2026-10-04", "visits": None, "visitors": None, "page_views": None},
        {"date": "2026-10-05", "visits": 2, "visitors": 1, "page_views": 2},
        {"date": "2026-10-06", "visits": 0, "visitors": 0, "page_views": 0},
        {"date": "2026-10-07", "visits": 2, "visitors": 2, "page_views": 3},
    ]
    assert data["metrics"]["visits_today"] == 2
    assert data["metrics"]["visitors_today"] == 2
    assert data["metrics"]["page_views_today"] == 3
    before = get_dashboard(dashboard, "?date=2026-10-04")
    assert before["metrics"]["visits_today"] is None
    assert before["traffic"] == data["traffic"]
    assert all(item["page_views"] is None for item in before["trend"])


@pytest.mark.parametrize("enabled,status", [(True, "not_started"), (False, "disabled")])
def test_unavailable_traffic_is_null_for_metrics_and_trend(dashboard, monkeypatch, enabled, status):
    monkeypatch.setattr(settings, "usage_tracking_enabled", enabled)
    if not enabled:
        with dashboard.session() as db:
            add_view(db, datetime(2026, 10, 6, 15))
            db.commit()
    data = get_dashboard(dashboard)
    assert data["traffic"]["status"] == status
    assert all(data["metrics"][field] is None for field in ("visits_today", "visitors_today", "page_views_today"))
    assert len(data["trend"]) == 7
    assert all(item[field] is None for item in data["trend"] for field in ("visits", "visitors", "page_views"))


def test_default_date_rolls_over_at_kst_midnight(dashboard, monkeypatch):
    monkeypatch.setattr(admin, "utc_now", lambda: datetime(2026, 10, 7, 15, tzinfo=timezone.utc))
    data = get_dashboard(dashboard)
    assert data["date"] == "2026-10-08"
    assert data["trend"][0]["date"] == "2026-10-02"
    assert data["trend"][-1]["date"] == "2026-10-08"


@pytest.mark.parametrize("query", [
    "date=2026-10-08", "date=2026-02-30", "date=2026-1-1", "date=0", "date=", "date=0001-01-01",
    "post_page=0", "comment_page=0", "post_page=-1", "size=0", "size=51",
])
def test_invalid_date_or_pagination_returns_normalized_validation_error(dashboard, query):
    response = dashboard.client.get(f"/api/admin/dashboard?{query}", headers=dashboard.headers["admin"])
    assert response.status_code == 422
    assert response.json()["status"] == "error"
    assert response.json()["code"] == "VALIDATION_ERROR"
