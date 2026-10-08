from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from datetime import timedelta
from pathlib import Path
from uuid import uuid4

from sqlalchemy import delete, func, or_, select
from sqlalchemy.orm import Session

from app.author_snapshots import DELETED_USER_NICKNAME
from app.errors import AppException
from app.media_service import media_storage_path, private_upload_directory, public_upload_directory
from app.models.audit import AccountDeletionReceipt, OperationalAuditLog
from app.config import settings
from app.models.auth import EmailVerificationToken, PasswordResetToken, RefreshToken
from app.models.banner import Banner
from app.models.bookmark import Bookmark
from app.models.comment import Comment
from app.models.event import Event
from app.models.like import Like
from app.models.media import MediaAsset, PostAttachment
from app.models.notification import Notification, NotificationSetting, PushDelivery, PushToken
from app.models.post import Post
from app.models.poll import PollBallot, PollOption
from app.models.post_extension import PostMutualAid, PostSuggestion
from app.models.rate_limit import RateLimitBucket
from app.models.registration import PrivacyPolicyVersion
from app.models.report import Report
from app.models.search import SearchHistory
from app.models.user import User
from app.models.usage import UsagePageView
from app.models.user_block import UserBlock
from app.rate_limit import subject_rate_limit_hash
from app.security import generate_token_urlsafe, utc_now, verify_password
from app.usage_identity import usage_visitor_key


logger = logging.getLogger(__name__)

ACCOUNT_DELETE_PURPOSE = "account_delete"
_STAGING_SUFFIX = ".account-delete"


@dataclass(frozen=True)
class StagedFileDeletion:
    original_path: Path
    staged_path: Path


@dataclass(frozen=True)
class AccountDeletionResult:
    receipt_id: str
    completed_at: str
    deleted_user_id: int
    retained_posts: int
    retained_comments: int
    retained_attached_media: int
    deleted_unattached_media: int


def _media_paths_for_deletion(media: MediaAsset) -> tuple[Path, ...]:
    primary_path = media_storage_path(media)
    if not media.is_private:
        return (primary_path,)

    # A private asset may still be in the legacy public directory until the
    # startup compatibility migration has moved it. Remove either location.
    legacy_path = public_upload_directory() / primary_path.name
    if legacy_path == primary_path:
        return (primary_path,)
    return (primary_path, legacy_path)


def _stage_files(media_items: list[MediaAsset]) -> list[StagedFileDeletion]:
    staged: list[StagedFileDeletion] = []
    seen_paths: set[Path] = set()
    try:
        for media in media_items:
            for original_path in _media_paths_for_deletion(media):
                if original_path in seen_paths:
                    continue
                seen_paths.add(original_path)
                if not original_path.is_file():
                    continue
                staged_path = original_path.with_name(
                    f".{original_path.name}.{generate_token_urlsafe()}{_STAGING_SUFFIX}"
                )
                os.replace(original_path, staged_path)
                staged.append(StagedFileDeletion(original_path=original_path, staged_path=staged_path))
    except BaseException:
        _restore_staged_files(staged)
        raise
    return staged


def _restore_staged_files(staged: list[StagedFileDeletion]) -> None:
    for item in reversed(staged):
        try:
            if item.staged_path.exists() and not item.original_path.exists():
                os.replace(item.staged_path, item.original_path)
        except OSError:
            logger.exception("Failed to restore account-deletion media file %s", item.original_path)


def _finalize_staged_files(staged: list[StagedFileDeletion]) -> None:
    for item in staged:
        try:
            item.staged_path.unlink(missing_ok=True)
        except OSError:
            # The staged name is not addressable through the media API. Startup
            # cleanup retries the physical removal without retaining a DB link.
            logger.exception("Failed to finalize account-deletion media file %s", item.staged_path)


def purge_account_deletion_staging_files() -> None:
    """Best-effort retry for protected files left after a committed deletion."""

    for directory in {public_upload_directory(), private_upload_directory()}:
        if not directory.is_dir():
            continue
        for path in directory.glob(f".*{_STAGING_SUFFIX}"):
            try:
                path.unlink(missing_ok=True)
            except OSError:
                logger.exception("Failed to purge staged account-deletion file %s", path)


def purge_expired_account_deletion_receipts(db: Session) -> int:
    """Remove non-identifying receipts after the operator-approved interval."""

    retention_days = settings.account_deletion_receipt_retention_days
    if retention_days is None:
        return 0
    cutoff = utc_now() - timedelta(days=retention_days)
    result = db.execute(
        delete(AccountDeletionReceipt).where(AccountDeletionReceipt.completed_at < cutoff)
    )
    db.commit()
    return int(result.rowcount or 0)


def _delete_push_history(db: Session, user_id: int) -> None:
    push_token_ids = list(db.scalars(select(PushToken.id).where(PushToken.user_id == user_id)).all())
    notification_ids = list(db.scalars(select(Notification.id).where(Notification.user_id == user_id)).all())
    conditions = []
    if push_token_ids:
        conditions.append(PushDelivery.push_token_id.in_(push_token_ids))
    if notification_ids:
        conditions.append(PushDelivery.notification_id.in_(notification_ids))
    if conditions:
        db.execute(delete(PushDelivery).where(or_(*conditions)))


def _scrub_notification_messages(db: Session, user_id: int, nickname: str) -> None:
    if not nickname:
        return
    notifications = db.scalars(
        select(Notification).where(
            Notification.user_id != user_id,
            Notification.message.contains(nickname),
        )
    ).all()
    for notification in notifications:
        notification.message = notification.message.replace(nickname, DELETED_USER_NICKNAME)


def _scrub_audit_links(db: Session, user_id: int) -> None:
    logs = db.scalars(
        select(OperationalAuditLog).where(
            or_(
                OperationalAuditLog.actor_id == user_id,
                (
                    (OperationalAuditLog.target_type == "user")
                    & (OperationalAuditLog.target_id == user_id)
                ),
            )
        )
    ).all()
    for log in logs:
        if log.actor_id == user_id:
            log.actor_id = None
        if log.target_type == "user" and log.target_id == user_id:
            log.target_id = None
            log.details = None


def _recalculate_post_counts(db: Session, post_ids: set[int]) -> None:
    if not post_ids:
        return
    posts = db.scalars(select(Post).where(Post.id.in_(post_ids))).all()
    for post in posts:
        post.like_count = int(db.scalar(select(func.count(Like.id)).where(Like.post_id == post.id)) or 0)
        post.comment_count = int(
            db.scalar(select(func.count(Comment.id)).where(Comment.post_id == post.id)) or 0
        )


def delete_user_account(
    db: Session,
    *,
    user_id: int,
    current_password: str,
    channel: str = "authenticated",
) -> AccountDeletionResult:
    """Hard-delete account PII while retaining every authored post and comment.

    Administrators must first transfer operational ownership and be demoted by
    another administrator. This prevents a self-service deletion from
    orphaning the only privileged operator or official content.
    """

    user = db.scalar(
        select(User)
        .where(User.id == user_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if user is None:
        raise AppException(
            status_code=401,
            message="Account deletion request is invalid.",
            code="UNAUTHORIZED",
        )
    if user.role == "admin":
        raise AppException(
            status_code=409,
            message="Administrators must transfer responsibilities and be demoted before deleting their account.",
            code="ADMIN_ACCOUNT_DELETION_FORBIDDEN",
        )
    if not verify_password(current_password, user.password_hash):
        raise AppException(
            status_code=403,
            message="Current password is invalid.",
            code="FORBIDDEN",
        )
    if channel not in {"authenticated", "public_email"}:
        raise ValueError("Unsupported account deletion channel.")

    receipt_id = str(uuid4())
    completed_at = utc_now()

    user_posts = db.scalars(
        select(Post).where(Post.author_id == user.id).with_for_update()
    ).all()
    authored_comments = db.scalars(
        select(Comment).where(Comment.author_id == user.id).with_for_update()
    ).all()
    authored_post_ids = {post.id for post in user_posts}
    authored_comment_ids = {comment.id for comment in authored_comments}
    affected_comment_post_ids = {comment.post_id for comment in authored_comments}
    affected_like_post_ids = set(
        db.scalars(select(Like.post_id).where(Like.user_id == user.id)).all()
    )

    owned_media = list(
        db.scalars(select(MediaAsset).where(MediaAsset.owner_id == user.id).with_for_update()).all()
    )
    retained_media_ids = set(
        db.scalars(
            select(PostAttachment.media_id)
            .join(MediaAsset, MediaAsset.id == PostAttachment.media_id)
            .where(MediaAsset.owner_id == user.id)
        ).all()
    )
    retained_media_ids.update(db.scalars(select(PollOption.media_id).join(MediaAsset, MediaAsset.id == PollOption.media_id)
                                       .where(MediaAsset.owner_id == user.id)).all())
    deleted_media = [
        media
        for media in owned_media
        if media.id not in retained_media_ids
    ]
    deleted_media_ids = {media.id for media in deleted_media}
    staged_files = _stage_files(deleted_media)

    try:
        _delete_push_history(db, user.id)
        _scrub_notification_messages(db, user.id, user.nickname)
        _scrub_audit_links(db, user.id)

        if deleted_media_ids:
            db.execute(delete(PostAttachment).where(PostAttachment.media_id.in_(deleted_media_ids)))
            db.execute(delete(MediaAsset).where(MediaAsset.id.in_(deleted_media_ids)))

        for media in owned_media:
            if media.id in retained_media_ids:
                media.owner_id = None

        for comment in authored_comments:
            if not comment.author_nickname_snapshot:
                comment.author_nickname_snapshot = user.nickname
            if comment.author_cohort_snapshot is None:
                comment.author_cohort_snapshot = user.cohort
            comment.author_id = None
        for post in user_posts:
            if not post.author_nickname_snapshot:
                post.author_nickname_snapshot = user.nickname
            if post.author_cohort_snapshot is None:
                post.author_cohort_snapshot = user.cohort
            post.author_id = None

        db.execute(delete(Like).where(Like.user_id == user.id))
        db.execute(delete(PollBallot).where(PollBallot.user_id == user.id))
        db.execute(delete(Bookmark).where(Bookmark.user_id == user.id))
        db.execute(delete(Report).where(Report.reporter_id == user.id))
        db.execute(delete(SearchHistory).where(SearchHistory.user_id == user.id))
        db.execute(delete(UsagePageView).where(UsagePageView.visitor_key == usage_visitor_key(user.id)))
        db.execute(
            delete(UserBlock).where(
                or_(
                    UserBlock.blocker_id == user.id,
                    UserBlock.blocked_user_id == user.id,
                )
            )
        )
        db.execute(delete(Notification).where(Notification.user_id == user.id))
        db.execute(delete(NotificationSetting).where(NotificationSetting.user_id == user.id))
        db.execute(delete(PushToken).where(PushToken.user_id == user.id))
        db.execute(delete(RefreshToken).where(RefreshToken.user_id == user.id))
        db.execute(delete(PasswordResetToken).where(PasswordResetToken.user_id == user.id))
        db.execute(delete(EmailVerificationToken).where(EmailVerificationToken.email == user.email))
        db.execute(
            delete(RateLimitBucket).where(
                RateLimitBucket.subject_hash.in_(
                    {
                        subject_rate_limit_hash(user.email),
                        subject_rate_limit_hash(str(user.id)),
                    }
                )
            )
        )

        db.execute(Banner.__table__.update().where(Banner.created_by == user.id).values(created_by=None))
        db.execute(Event.__table__.update().where(Event.created_by == user.id).values(created_by=None))
        db.execute(
            PostSuggestion.__table__.update()
            .where(PostSuggestion.replied_by == user.id)
            .values(replied_by=None)
        )
        db.execute(
            PostMutualAid.__table__.update()
            .where(PostMutualAid.reviewed_by == user.id)
            .values(reviewed_by=None)
        )
        db.execute(
            PrivacyPolicyVersion.__table__.update()
            .where(PrivacyPolicyVersion.created_by == user.id)
            .values(created_by=None)
        )

        db.flush()
        _recalculate_post_counts(db, affected_comment_post_ids | affected_like_post_ids)
        db.execute(
            delete(User)
            .where(User.id == user.id)
            .execution_options(synchronize_session=False)
        )
        db.add(
            AccountDeletionReceipt(
                receipt_id=receipt_id,
                channel=channel,
                result="completed",
                completed_at=completed_at,
            )
        )
        db.commit()
    except BaseException:
        db.rollback()
        _restore_staged_files(staged_files)
        raise

    _finalize_staged_files(staged_files)
    return AccountDeletionResult(
        receipt_id=receipt_id,
        completed_at=completed_at.isoformat(),
        deleted_user_id=user_id,
        retained_posts=len(authored_post_ids),
        retained_comments=len(authored_comment_ids),
        retained_attached_media=len(retained_media_ids),
        deleted_unattached_media=len(deleted_media_ids),
    )
