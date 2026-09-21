from __future__ import annotations

from datetime import datetime, timedelta
import logging
from pathlib import Path
from uuid import UUID

import pytest
from sqlalchemy import func, inspect, select

from app import account_deletion
from app.account_deletion import (
    DELETED_USER_NICKNAME,
    delete_user_account,
    purge_expired_account_deletion_receipts,
)
from app.config import settings
from app.database import Base
from app.models.auth import EmailVerificationToken, PasswordResetToken, RefreshToken
from app.models.audit import AccountDeletionReceipt
from app.models.bookmark import Bookmark
from app.models.comment import Comment
from app.models.like import Like
from app.models.media import MediaAsset, PostAttachment
from app.models.notification import Notification, NotificationSetting, PushDelivery, PushToken
from app.models.post import Post
from app.models.post_extension import PostMutualAid
from app.models.rate_limit import RateLimitBucket
from app.models.report import Report
from app.models.search import SearchHistory
from app.models.user import User
from app.models.user_block import UserBlock
from app.rate_limit import subject_rate_limit_hash
from app.routers import auth as auth_router
from app.security import hash_token, utc_now

from conftest import TEST_PASSWORD


def _set_media_directories(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> tuple[Path, Path]:
    public_directory = tmp_path / "public"
    private_directory = tmp_path / "private"
    public_directory.mkdir()
    private_directory.mkdir()
    monkeypatch.setattr(settings, "media_upload_dir", public_directory)
    monkeypatch.setattr(settings, "media_private_upload_dir", private_directory)
    return public_directory, private_directory


def _count(db, model) -> int:
    return int(db.scalar(select(func.count()).select_from(model)) or 0)


def test_authenticated_account_deletion_removes_pii_and_preserves_all_authored_content(
    api,
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    public_directory, private_directory = _set_media_directories(monkeypatch, tmp_path)
    public_file = public_directory / "thumbnail.png"
    private_file = private_directory / "mutual-aid-proof.pdf"
    orphan_file = private_directory / "unattached-upload.pdf"
    shared_file = public_directory / "shared-on-other-post.png"
    public_file.write_bytes(b"public image")
    private_file.write_bytes(b"private evidence")
    orphan_file.write_bytes(b"unattached evidence")
    shared_file.write_bytes(b"shared image")

    now = utc_now()
    with api.session() as db:
        public_post = db.get(Post, 3)
        mutual_aid_post = db.get(Post, 1)
        assert public_post is not None
        assert mutual_aid_post is not None
        mutual_aid_post.metadata_json = {"proof_url": "https://example.com/private-proof"}
        public_comment = Comment(post_id=public_post.id, author_id=1, content="A public answer")
        private_evidence = MediaAsset(
            owner_id=1,
            original_filename="identity-proof.pdf",
            stored_filename=private_file.name,
            content_type="application/pdf",
            file_size=private_file.stat().st_size,
            url=None,
            is_private=True,
            status="ready",
        )
        unattached_upload = MediaAsset(
            owner_id=1,
            original_filename="unattached-upload.pdf",
            stored_filename=orphan_file.name,
            content_type="application/pdf",
            file_size=orphan_file.stat().st_size,
            url=None,
            is_private=True,
            status="ready",
        )
        shared_attachment = MediaAsset(
            owner_id=1,
            original_filename="shared-on-other-post.png",
            stored_filename=shared_file.name,
            content_type="image/png",
            file_size=shared_file.stat().st_size,
            url=None,
            is_private=False,
            status="ready",
        )
        draft_post = Post(
            board_id=2,
            author_id=1,
            title="Owner draft retained",
            content="Draft body",
            status="draft",
        )
        deleted_post = Post(
            board_id=2,
            author_id=1,
            title="Owner soft-deleted retained",
            content="Deleted body",
            status="deleted",
            deleted_at=now,
        )
        owner_notification = Notification(
            user_id=1,
            notification_type="comment",
            message="Private account notification",
            post_id=public_post.id,
        )
        other_notification = Notification(
            user_id=2,
            notification_type="comment",
            message="Owner commented on your post.",
            post_id=public_post.id,
        )
        push_token = PushToken(user_id=1, token="ExponentPushToken[owner-secret]", platform="android")

        public_post.like_count = 1
        public_post.comment_count = 1
        db.add_all(
            [
                public_comment,
                private_evidence,
                unattached_upload,
                shared_attachment,
                draft_post,
                deleted_post,
                Like(user_id=1, post_id=public_post.id),
                Bookmark(user_id=1, post_id=public_post.id),
                Report(
                    reporter_id=1,
                    target_type="post",
                    target_id=2,
                    reason="spam",
                ),
                SearchHistory(user_id=1, keyword="sensitive query"),
                UserBlock(blocker_id=1, blocked_user_id=2, reason="private reason"),
                NotificationSetting(user_id=1),
                owner_notification,
                other_notification,
                push_token,
                RefreshToken(
                    user_id=1,
                    token_hash=hash_token("owner-refresh-token"),
                    expires_at=now + timedelta(days=1),
                ),
                PasswordResetToken(
                    user_id=1,
                    token_hash=hash_token("owner-reset-token"),
                    expires_at=now + timedelta(minutes=5),
                ),
                EmailVerificationToken(
                    email="owner@sogang.ac.kr",
                    code_hash=hash_token("123456"),
                    purpose="change_email",
                    expires_at=now + timedelta(minutes=5),
                ),
                RateLimitBucket(
                    action="auth.login",
                    subject_hash=subject_rate_limit_hash("owner@sogang.ac.kr"),
                    window_started_at=now,
                    count=1,
                    updated_at=now,
                ),
                RateLimitBucket(
                    action="post.create",
                    subject_hash=subject_rate_limit_hash("1"),
                    window_started_at=now,
                    count=1,
                    updated_at=now,
                ),
            ]
        )
        db.flush()
        db.add(PostAttachment(post_id=1, media_id=private_evidence.id, sort_order=0))
        db.add(PostAttachment(post_id=2, media_id=shared_attachment.id, sort_order=0))
        db.flush()
        db.add(
            PushDelivery(
                notification_id=owner_notification.id,
                push_token_id=push_token.id,
                token_snapshot=push_token.token,
            )
        )
        db.commit()
        public_comment_id = public_comment.id
        private_media_id = private_evidence.id
        unattached_media_id = unattached_upload.id
        shared_media_id = shared_attachment.id
        draft_post_id = draft_post.id
        deleted_post_id = deleted_post.id

    wrong_password = api.client.request(
        "DELETE",
        "/api/users/me",
        headers=api.headers["owner"],
        json={"current_password": "WrongPassword1!"},
    )
    assert wrong_password.status_code == 403
    assert wrong_password.json() == {
        "status": "error",
        "message": "Current password is invalid.",
        "code": "FORBIDDEN",
    }
    assert private_file.is_file()
    with api.session() as db:
        assert db.get(User, 1) is not None

    response = api.client.request(
        "DELETE",
        "/api/users/me",
        headers=api.headers["owner"],
        json={"current_password": TEST_PASSWORD},
    )
    assert response.status_code == 200
    response_data = response.json()["data"]
    assert response_data["deleted"] is True
    receipt_id = str(UUID(response_data["receipt_id"]))
    datetime.fromisoformat(response_data["completed_at"])

    assert public_file.read_bytes() == b"public image"
    assert private_file.read_bytes() == b"private evidence"
    assert shared_file.read_bytes() == b"shared image"
    assert not orphan_file.exists()
    assert not list(private_directory.glob(".*.account-delete"))
    with api.session() as db:
        receipt = db.get(AccountDeletionReceipt, receipt_id)
        assert receipt is not None
        assert receipt.channel == "authenticated"
        assert receipt.result == "completed"
        assert set(inspect(AccountDeletionReceipt).columns.keys()) == {
            "receipt_id",
            "channel",
            "result",
            "completed_at",
        }
        assert db.get(User, 1) is None
        mutual_aid_post = db.get(Post, 1)
        hidden_post = db.get(Post, 4)
        draft_post = db.get(Post, draft_post_id)
        deleted_post = db.get(Post, deleted_post_id)
        for retained_post in (mutual_aid_post, hidden_post, draft_post, deleted_post):
            assert retained_post is not None
            assert retained_post.author_id is None
            assert retained_post.author_nickname_snapshot == "Owner"
        assert mutual_aid_post.status == "published"
        assert db.scalar(
            select(PostMutualAid).where(PostMutualAid.post_id == mutual_aid_post.id)
        ) is not None
        assert hidden_post.status == "hidden"
        assert draft_post.status == "draft"
        assert deleted_post.status == "deleted"
        assert deleted_post.deleted_at == now

        retained_private_media = db.get(MediaAsset, private_media_id)
        assert retained_private_media is not None
        assert retained_private_media.owner_id is None
        assert retained_private_media.original_filename == "identity-proof.pdf"
        assert db.get(PostAttachment, 2) is not None
        assert db.get(MediaAsset, unattached_media_id) is None

        retained_shared_media = db.get(MediaAsset, shared_media_id)
        assert retained_shared_media is not None
        assert retained_shared_media.owner_id is None
        assert retained_shared_media.original_filename == "shared-on-other-post.png"
        assert db.scalar(
            select(PostAttachment).where(
                PostAttachment.post_id == 2,
                PostAttachment.media_id == shared_media_id,
            )
        ) is not None

        surviving_post = db.get(Post, 3)
        assert surviving_post is not None
        assert surviving_post.author_id is None
        assert surviving_post.author_nickname_snapshot == "Owner"
        assert surviving_post.like_count == 0
        assert surviving_post.comment_count == 1

        surviving_comment = db.get(Comment, public_comment_id)
        assert surviving_comment is not None
        assert surviving_comment.author_id is None
        assert surviving_comment.author_nickname_snapshot == "Owner"
        assert surviving_comment.content == "A public answer"

        mutual_aid_comment = db.scalar(select(Comment).where(Comment.post_id == 1))
        assert mutual_aid_comment is not None
        assert mutual_aid_comment.author_id is None
        assert mutual_aid_comment.author_nickname_snapshot == "Owner"
        assert mutual_aid_comment.content == "Owner comment"

        public_media = db.get(MediaAsset, 1)
        assert public_media is not None
        assert public_media.owner_id is None
        assert public_media.original_filename == "thumbnail.png"

        for model in (
            Like,
            Bookmark,
            Report,
            SearchHistory,
            UserBlock,
            NotificationSetting,
            PushToken,
            PushDelivery,
            RefreshToken,
            PasswordResetToken,
            EmailVerificationToken,
            RateLimitBucket,
        ):
            assert _count(db, model) == 0

        notifications = db.scalars(select(Notification).order_by(Notification.id)).all()
        assert len(notifications) == 1
        assert notifications[0].user_id == 2
        assert notifications[0].message == f"{DELETED_USER_NICKNAME} commented on your post."

    old_session = api.client.get("/api/users/me", headers=api.headers["owner"])
    assert old_session.status_code == 401
    assert old_session.json()["code"] == "UNAUTHORIZED"

    post_detail = api.client.get("/api/posts/3", headers=api.headers["other"])
    assert post_detail.status_code == 200
    assert post_detail.json()["data"]["author_id"] is None
    assert post_detail.json()["data"]["author_nickname"] == "Owner"

    comments = api.client.get("/api/posts/3/comments", headers=api.headers["other"])
    assert comments.status_code == 200
    assert comments.json()["data"][0]["author_id"] is None
    assert comments.json()["data"][0]["author_nickname"] == "Owner"

    # 상조회 증빙(첨부·링크)은 게시글을 읽을 수 있는 원우 모두에게 공개한다.
    member_mutual_aid = api.client.get("/api/posts/1", headers=api.headers["other"])
    assert member_mutual_aid.status_code == 200
    assert member_mutual_aid.json()["data"]["attachments"][0]["id"] == private_media_id
    assert member_mutual_aid.json()["data"]["metadata"]["proof_url"] == "https://example.com/private-proof"
    assert api.client.get(
        f"/api/media/{private_media_id}/access-url",
        headers=api.headers["other"],
    ).status_code == 200

    admin_mutual_aid = api.client.get("/api/posts/1", headers=api.headers["admin"])
    assert admin_mutual_aid.status_code == 200
    assert admin_mutual_aid.json()["data"]["attachments"][0]["id"] == private_media_id
    assert admin_mutual_aid.json()["data"]["metadata"]["proof_url"] == "https://example.com/private-proof"
    assert api.client.get(
        f"/api/media/{private_media_id}/access-url",
        headers=api.headers["admin"],
    ).status_code == 200


def test_admin_must_be_demoted_before_self_deletion(api) -> None:
    response = api.client.request(
        "DELETE",
        "/api/users/me",
        headers=api.headers["admin"],
        json={"current_password": TEST_PASSWORD},
    )

    assert response.status_code == 409
    assert response.json() == {
        "status": "error",
        "message": "Administrators must transfer responsibilities and be demoted before deleting their account.",
        "code": "ADMIN_ACCOUNT_DELETION_FORBIDDEN",
    }
    with api.session() as db:
        assert db.get(User, 3) is not None


def test_public_deletion_flow_is_non_enumerating_and_repeat_safe(
    api,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    delivered_subjects: list[str] = []
    delivered_html_bodies: list[str] = []

    def capture_email(_recipient, subject, _plain_body, **kwargs) -> bool:
        delivered_subjects.append(subject)
        delivered_html_bodies.append(kwargs["html_body"])
        return True

    monkeypatch.setattr(auth_router, "generate_verification_code", lambda: "123456")
    monkeypatch.setattr(auth_router, "is_email_configured", lambda: True)
    monkeypatch.setattr(auth_router, "send_email", capture_email)
    monkeypatch.setattr(settings, "support_email", "A72040@sogang.ac.kr")

    known_request = api.client.post(
        "/api/auth/account-deletion/request",
        json={"email": "owner@sogang.ac.kr"},
    )
    unknown_request = api.client.post(
        "/api/auth/account-deletion/request",
        json={"email": "missing@sogang.ac.kr"},
    )
    assert known_request.status_code == unknown_request.status_code == 200
    assert known_request.json() == unknown_request.json()
    assert known_request.json()["data"]["accepted"] is True
    assert "code" not in known_request.json()["data"]
    assert delivered_subjects == ["[AI·SW CAMPUS] 요청하신 계정 삭제 확인 코드"]
    assert "A72040@sogang.ac.kr" in delivered_html_bodies[0]

    generic_error = {
        "status": "error",
        "message": "Invalid or expired account deletion request.",
        "code": "ACCOUNT_DELETION_INVALID",
    }
    unknown_verify = api.client.post(
        "/api/auth/account-deletion/verify",
        json={
            "email": "missing@sogang.ac.kr",
            "code": "123456",
            "current_password": TEST_PASSWORD,
        },
    )
    wrong_code = api.client.post(
        "/api/auth/account-deletion/verify",
        json={
            "email": "owner@sogang.ac.kr",
            "code": "000000",
            "current_password": TEST_PASSWORD,
        },
    )
    wrong_password = api.client.post(
        "/api/auth/account-deletion/verify",
        json={
            "email": "owner@sogang.ac.kr",
            "code": "123456",
            "current_password": "WrongPassword1!",
        },
    )
    for response in (unknown_verify, wrong_code, wrong_password):
        assert response.status_code == 400
        assert response.json() == generic_error

    verified = api.client.post(
        "/api/auth/account-deletion/verify",
        json={
            "email": "owner@sogang.ac.kr",
            "code": "123456",
            "current_password": TEST_PASSWORD,
        },
    )
    assert verified.status_code == 200
    verified_data = verified.json()["data"]
    assert verified_data["deleted"] is True
    public_receipt_id = str(UUID(verified_data["receipt_id"]))
    datetime.fromisoformat(verified_data["completed_at"])
    with api.session() as db:
        receipt = db.get(AccountDeletionReceipt, public_receipt_id)
        assert receipt is not None
        assert receipt.channel == "public_email"
        assert receipt.result == "completed"

    repeated_request = api.client.post(
        "/api/auth/account-deletion/request",
        json={"email": "owner@sogang.ac.kr"},
    )
    repeated_verify = api.client.post(
        "/api/auth/account-deletion/verify",
        json={
            "email": "owner@sogang.ac.kr",
            "code": "123456",
            "current_password": TEST_PASSWORD,
        },
    )
    assert repeated_request.status_code == 200
    assert repeated_request.json() == known_request.json()
    assert repeated_verify.status_code == 400
    assert repeated_verify.json() == generic_error


def test_public_deletion_request_without_smtp_leaks_no_code_or_email(
    api,
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    monkeypatch.setattr(auth_router, "generate_verification_code", lambda: "654321")
    monkeypatch.setattr(auth_router, "is_email_configured", lambda: False)

    with caplog.at_level(logging.WARNING):
        response = api.client.post(
            "/api/auth/account-deletion/request",
            json={"email": "owner@sogang.ac.kr"},
        )

    assert response.status_code == 200
    assert response.json()["data"]["accepted"] is True
    assert all("654321" not in message for message in caplog.messages)
    assert all("owner@sogang.ac.kr" not in message for message in caplog.messages)
    with api.session() as db:
        token_count = db.scalar(
            select(func.count())
            .select_from(EmailVerificationToken)
            .where(EmailVerificationToken.purpose == "account_delete")
        )
        assert token_count == 0


def test_transaction_failure_restores_private_file_and_database(
    api,
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    _, private_directory = _set_media_directories(monkeypatch, tmp_path)
    private_file = private_directory / "rollback-proof.pdf"
    private_file.write_bytes(b"must survive rollback")

    with api.session() as db:
        evidence = MediaAsset(
            owner_id=1,
            original_filename="rollback-proof.pdf",
            stored_filename=private_file.name,
            content_type="application/pdf",
            file_size=private_file.stat().st_size,
            is_private=True,
            status="ready",
        )
        db.add(evidence)
        db.flush()
        db.add(PostAttachment(post_id=1, media_id=evidence.id, sort_order=1))
        db.commit()
        evidence_id = evidence.id

        def fail_commit() -> None:
            raise RuntimeError("simulated commit failure")

        monkeypatch.setattr(db, "commit", fail_commit)
        with pytest.raises(RuntimeError, match="simulated commit failure"):
            delete_user_account(db, user_id=1, current_password=TEST_PASSWORD)

    assert private_file.read_bytes() == b"must survive rollback"
    assert not list(private_directory.glob(".*.account-delete"))
    with api.session() as db:
        assert db.get(User, 1) is not None
        assert db.get(Post, 1) is not None
        assert db.get(MediaAsset, evidence_id) is not None


def test_account_deletion_foreign_key_contract() -> None:
    expected = {
        ("posts", "author_id"): (True, "SET NULL"),
        ("comments", "author_id"): (True, "SET NULL"),
        ("media_assets", "owner_id"): (True, "SET NULL"),
        ("likes", "user_id"): (False, "CASCADE"),
        ("bookmarks", "user_id"): (False, "CASCADE"),
    }

    for (table_name, column_name), (nullable, ondelete) in expected.items():
        table = Base.metadata.tables[table_name]
        column = table.c[column_name]
        foreign_key = next(iter(column.foreign_keys))
        assert column.nullable is nullable
        assert foreign_key.ondelete == ondelete

    purpose_constraint = next(
        constraint
        for constraint in inspect(EmailVerificationToken).local_table.constraints
        if constraint.name == "ck_email_verification_tokens_purpose"
    )
    assert "account_delete" in str(purpose_constraint.sqltext)


def test_account_deletion_receipt_retention_removes_only_expired_rows(
    api,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "account_deletion_receipt_retention_days", 30)
    now = utc_now()
    with api.session() as db:
        db.add_all(
            [
                AccountDeletionReceipt(
                    receipt_id="00000000-0000-0000-0000-000000000001",
                    channel="authenticated",
                    result="completed",
                    completed_at=now - timedelta(days=31),
                ),
                AccountDeletionReceipt(
                    receipt_id="00000000-0000-0000-0000-000000000002",
                    channel="public_email",
                    result="completed",
                    completed_at=now - timedelta(days=29),
                ),
            ]
        )
        db.commit()

        assert purge_expired_account_deletion_receipts(db) == 1
        assert db.get(AccountDeletionReceipt, "00000000-0000-0000-0000-000000000001") is None
        assert db.get(AccountDeletionReceipt, "00000000-0000-0000-0000-000000000002") is not None
