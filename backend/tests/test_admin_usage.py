from datetime import datetime, timedelta
from uuid import uuid4

import pytest

from sqlalchemy import select

from app.config import settings
from app.routers import admin


@pytest.fixture(autouse=True)
def isolate_usage_rate_limiter(monkeypatch):
    # Like the other API fixtures: rate-limit buckets use their own database;
    # navigation/session behavior is tested against this fixture's real DB.
    from app.routers import usage
    monkeypatch.setattr(usage, "enforce_rate_limit", lambda *_args, **_kwargs: None)


def event(device, event_id=None):
    return {"event_id": event_id or str(uuid4()), "device_id": device, "screen": "home"}


def test_usage_requires_login_and_excludes_administrators(api):
    payload = event(str(uuid4()))
    assert api.client.post("/api/usage/page-views", json=payload).status_code == 401
    response = api.client.post("/api/usage/page-views", json=payload, headers=api.headers["admin"])
    assert response.status_code == 200
    assert response.json()["data"]["accepted"] is False


def test_traffic_deduplicates_events_and_counts_sessions_and_visitors(api, monkeypatch):
    from app.routers import usage
    now = datetime(2026, 10, 7, 2, 30)
    monkeypatch.setattr(usage, "utc_now", lambda: now)
    monkeypatch.setattr(admin, "utc_now", lambda: now)
    monkeypatch.setattr(settings, "usage_tracking_enabled", True)
    device = str(uuid4())
    first = event(device)
    for payload in (first, first, event(device)):
        assert api.client.post("/api/usage/page-views", json=payload, headers=api.headers["owner"]).status_code == 200
    api.client.post("/api/usage/page-views", json=event(str(uuid4())), headers=api.headers["other"])
    data = api.client.get("/api/admin/main", headers=api.headers["admin"]).json()["data"]
    assert data["metrics"]["page_views_today"] == 3
    assert data["metrics"]["visits_today"] == 2
    assert data["metrics"]["visitors_today"] == 2
    assert data["traffic"]["status"] == "collecting"
    monkeypatch.setattr(usage, "utc_now", lambda: now + timedelta(minutes=30))
    monkeypatch.setattr(admin, "utc_now", lambda: now + timedelta(minutes=30))
    api.client.post("/api/usage/page-views", json=event(device), headers=api.headers["owner"])
    metrics = api.client.get("/api/admin/main", headers=api.headers["admin"]).json()["data"]["metrics"]
    assert metrics["visits_today"] == 3
    assert metrics["visitors_today"] == 2
    assert metrics["page_views_today"] == 4


def test_traffic_stores_only_bounded_categories_and_pseudonymous_identity(api, monkeypatch):
    from app.models.usage import UsagePageView
    monkeypatch.setattr(settings, "usage_tracking_enabled", True)
    device = str(uuid4())
    api.client.post("/api/usage/page-views", json=event(device), headers=api.headers["owner"])
    invalid = {**event(device), "screen": "/admin?email=private@example.com"}
    assert api.client.post("/api/usage/page-views", json=invalid, headers=api.headers["owner"]).status_code == 422
    with api.session() as db:
        row = db.scalar(select(UsagePageView))
        assert row.screen == "home"
        assert len(row.visitor_key) == 64
        assert not hasattr(row, "user_id") and not hasattr(row, "url")


def test_disabled_or_not_started_traffic_is_not_reported_as_zero(api, monkeypatch):
    monkeypatch.setattr(settings, "usage_tracking_enabled", False)
    result = api.client.post("/api/usage/page-views", json=event(str(uuid4())), headers=api.headers["owner"])
    assert result.json()["data"]["accepted"] is False
    data = api.client.get("/api/admin/main", headers=api.headers["admin"]).json()["data"]
    assert data["metrics"]["visits_today"] is None
    assert data["traffic"]["status"] == "disabled"


def test_account_deletion_removes_only_that_members_usage_events(api, monkeypatch):
    from app.models.usage import UsagePageView
    monkeypatch.setattr(settings, "usage_tracking_enabled", True)
    for principal in ("owner", "other"):
        assert api.client.post("/api/usage/page-views", json=event(str(uuid4())), headers=api.headers[principal]).status_code == 200
    response = api.client.request("DELETE", "/api/users/me", json={"current_password": "TestPassword1!"}, headers=api.headers["owner"])
    assert response.status_code == 200
    with api.session() as db:
        assert len(db.scalars(select(UsagePageView)).all()) == 1


def test_usage_rechecks_principal_after_waiting_for_account_lock(api, monkeypatch):
    from app.deps import get_current_user
    from app.main import app
    from app.models.user import User
    from app.models.usage import UsagePageView
    monkeypatch.setattr(settings, "usage_tracking_enabled", True)
    with api.session() as db:
        principal = db.get(User, 1)
        db.expunge(principal)
    assert api.client.request("DELETE", "/api/users/me", json={"current_password": "TestPassword1!"}, headers=api.headers["owner"]).status_code == 200
    # Simulate deletion committing after authentication but before the collector's lock.
    app.dependency_overrides[get_current_user] = lambda: principal
    try:
        response = api.client.post("/api/usage/page-views", json=event(str(uuid4())), headers=api.headers["owner"])
        assert response.status_code == 401
        with api.session() as db:
            assert db.scalar(select(UsagePageView)) is None
    finally:
        app.dependency_overrides.pop(get_current_user, None)
