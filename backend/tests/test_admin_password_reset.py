from datetime import timedelta

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.audit import OperationalAuditLog
from app.models.auth import PasswordResetToken, RefreshToken
from app.models.notification import PushToken
from app.models.user import User
from app.errors import AppException
from app.routers.users import update_password
from app.schemas.user import UserPasswordUpdate
from app.security import hash_password, hash_token, utc_now, verify_password

NEW_PASSWORD = "AdminChangedPassword2!"


def test_admin_can_reset_member_password_and_revoke_only_target_credentials(api):
    login = api.client.post("/api/auth/login", json={"email": "owner@sogang.ac.kr", "password": "TestPassword1!"}).json()["data"]
    with api.session() as db:
        now = utc_now()
        db.add_all([
            RefreshToken(user_id=2, token_hash=hash_token("other-refresh"), expires_at=now + timedelta(days=1)),
            PushToken(user_id=1, token="owner-push", platform="android"),
            PushToken(user_id=2, token="other-push", platform="android"),
            PasswordResetToken(user_id=1, token_hash=hash_token("old-owner-reset"), verified_at=now, expires_at=now + timedelta(minutes=30)),
            PasswordResetToken(user_id=2, token_hash=hash_token("other-reset"), verified_at=now, expires_at=now + timedelta(minutes=30)),
        ])
        db.commit()
    reset = api.client.put("/api/users/admin/users/1/password", headers=api.headers["admin"], json={"new_password": NEW_PASSWORD})
    assert reset.status_code == 200
    assert reset.json()["data"] == {"id": 1, "changed": True, "sessions_revoked": 1, "push_tokens_deactivated": 1, "reset_tokens_invalidated": 1}
    with api.session() as db:
        owner = db.get(User, 1)
        assert verify_password(NEW_PASSWORD, owner.password_hash)
        assert owner.password_hash.startswith("$argon2")
        assert not verify_password("TestPassword1!", owner.password_hash)
        assert owner.nickname == "Owner" and owner.role == "user" and owner.is_active
        assert db.scalar(select(RefreshToken).where(RefreshToken.user_id == 2)).revoked_at is None
        assert db.scalar(select(PushToken).where(PushToken.user_id == 2)).is_active
        assert db.scalar(select(PasswordResetToken).where(PasswordResetToken.user_id == 2)).consumed_at is None
        audit = db.scalar(select(OperationalAuditLog))
        assert audit.action == "user.password_reset" and audit.actor_id == 3 and audit.target_id == 1
        assert audit.details == {"sessions_revoked": 1, "push_tokens_deactivated": 1, "reset_tokens_invalidated": 1}
        assert NEW_PASSWORD not in str(audit.details) and owner.password_hash not in str(audit.details)
    assert api.client.post("/api/auth/refresh", json={"refresh_token": login["refresh_token"]}).status_code == 401
    assert api.client.post("/api/auth/password-reset/confirm", json={"token": "old-owner-reset", "new_password": "AnotherPassword3!"}).status_code == 400
    assert api.client.post("/api/auth/login", json={"email": "owner@sogang.ac.kr", "password": "TestPassword1!"}).status_code == 401
    assert api.client.post("/api/auth/login", json={"email": "owner@sogang.ac.kr", "password": NEW_PASSWORD}).status_code == 200


@pytest.mark.parametrize("payload", [{}, {"new_password": None}, {"new_password": "short"}, {"new_password": "Onlyletters!"}, {"new_password": "123456789!"}, {"new_password": "NoSpecial123"}, {"new_password": "A1!" + "x" * 1022}, {"new_password": NEW_PASSWORD, "role": "admin"}])
def test_invalid_reset_preserves_password_and_creates_no_audit(api, payload):
    reset = api.client.put("/api/users/admin/users/1/password", headers=api.headers["admin"], json=payload)
    assert reset.status_code == 422
    with api.session() as db:
        assert verify_password("TestPassword1!", db.get(User, 1).password_hash)
        assert db.scalar(select(OperationalAuditLog.id)) is None


def test_password_reset_requires_admin_and_existing_member(api):
    for headers in ({}, api.headers["owner"]):
        assert api.client.put("/api/users/admin/users/2/password", headers=headers, json={"new_password": NEW_PASSWORD}).status_code in (401, 403)
    assert api.client.put("/api/users/admin/users/999/password", headers=api.headers["admin"], json={"new_password": NEW_PASSWORD}).status_code == 404


def test_admin_can_reset_own_or_inactive_account_without_reactivating_it(api):
    with api.session() as db:
        db.get(User, 2).is_active = False
        db.commit()
    for member_id in (2, 3):
        reset = api.client.put(f"/api/users/admin/users/{member_id}/password", headers=api.headers["admin"], json={"new_password": NEW_PASSWORD})
        assert reset.status_code == 200
    with api.session() as db:
        assert db.get(User, 2).is_active is False
        assert db.get(User, 3).role == "admin"


def interleave_before_user_read(monkeypatch, change_credentials):
    """Simulate a reset committed after a credential row was already cached.

    SQLite cannot exercise PostgreSQL locks, but this catches stale identity-map
    credentials accepted by the API after the user serialization point.
    """
    original = Session.scalar
    original_get = Session.get
    fired = False

    def scalar(session, statement, *args, **kwargs):
        nonlocal fired
        if not fired and statement.column_descriptions[0].get("entity") is User:
            fired = True
            change_credentials()
        return original(session, statement, *args, **kwargs)

    def get(session, entity, *args, **kwargs):
        nonlocal fired
        if not fired and entity is User:
            fired = True
            change_credentials()
        return original_get(session, entity, *args, **kwargs)

    monkeypatch.setattr(Session, "scalar", scalar)
    monkeypatch.setattr(Session, "get", get)
    return lambda: fired


def test_refresh_rechecks_cached_token_after_competing_password_reset(api, monkeypatch):
    login = api.client.post("/api/auth/login", json={"email": "owner@sogang.ac.kr", "password": "TestPassword1!"}).json()["data"]
    token_hash = hash_token(login["refresh_token"])

    def revoke():
        with api.session() as db:
            db.execute(select(RefreshToken).where(RefreshToken.token_hash == token_hash)).scalar_one().revoked_at = utc_now()
            db.commit()

    did_interleave = interleave_before_user_read(monkeypatch, revoke)
    assert api.client.post("/api/auth/refresh", json={"refresh_token": login["refresh_token"]}).status_code == 401
    assert did_interleave()
    with api.session() as db:
        assert db.scalars(select(RefreshToken).where(RefreshToken.user_id == 1, RefreshToken.revoked_at.is_(None))).all() == []


def test_reset_confirm_rechecks_cached_token_after_admin_invalidation(api, monkeypatch):
    with api.session() as db:
        now = utc_now()
        db.add(PasswordResetToken(user_id=1, token_hash=hash_token("cached-reset"), verified_at=now, expires_at=now + timedelta(minutes=15)))
        db.commit()

    def invalidate():
        with api.session() as db:
            db.execute(select(PasswordResetToken).where(PasswordResetToken.user_id == 1)).scalar_one().consumed_at = utc_now()
            db.commit()

    did_interleave = interleave_before_user_read(monkeypatch, invalidate)
    assert api.client.post("/api/auth/password-reset/confirm", json={"token": "cached-reset", "new_password": NEW_PASSWORD}).status_code == 400
    assert did_interleave()
    with api.session() as db:
        assert verify_password("TestPassword1!", db.get(User, 1).password_hash)


def test_self_password_change_rechecks_password_loaded_before_admin_reset(api):
    with api.session() as request_db:
        cached_user = request_db.get(User, 1)
        with api.session() as reset_db:
            reset_db.get(User, 1).password_hash = hash_password(NEW_PASSWORD)
            reset_db.commit()
        with pytest.raises(AppException) as rejected:
            update_password(UserPasswordUpdate(current_password="TestPassword1!", new_password="AnotherPassword3!"), request_db, cached_user)
        assert rejected.value.status_code == 403
    with api.session() as db:
        assert verify_password(NEW_PASSWORD, db.get(User, 1).password_hash)
