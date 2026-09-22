from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.models.notification import Notification, NotificationSetting
from app.models.user import User
from app.push import send_push_to_user


def quoted_preview(text: str, limit: int = 40) -> str:
    """Collapse whitespace and quote a title/body snippet for notification messages."""
    collapsed = " ".join(text.split())
    if len(collapsed) > limit:
        collapsed = f"{collapsed[:limit]}…"
    return f'"{collapsed}"'


def _dday_suffix(days_before: int) -> str:
    return "오늘이에요" if days_before == 0 else f"{days_before}일 남았어요"


# Message wording lives here so routers and scripts/send_test_notifications.py cannot drift apart.
ADMIN_REPLY_MESSAGE = "건의사항에 답변이 등록되었어요"
# 처리중 전환은 알리지 않는다 — 승인/반려 같은 결과 상태만 알림.
MUTUAL_AID_MESSAGES = {
    "completed": "상조회 신청이 승인되었어요",
    "rejected": "상조회 신청이 반려되었어요",
}


def notice_message(title: str) -> str:
    return f"{title} 공지가 등록되었어요"


def comment_message(content: str) -> str:
    return f"내 게시글에 새 댓글이 달렸어요: {quoted_preview(content)}"


def like_message(post_title: str) -> str:
    # Figma 알림항목: "게시글 제목"이 추천을 받았어요
    return f"{quoted_preview(post_title)}이 추천을 받았어요"


def report_message(nickname: str, target_type: str) -> str:
    return f"{nickname}님이 {'게시글' if target_type == 'post' else '댓글'}을 신고했어요"


def event_message(title: str, days_before: int) -> str:
    return f"{title} 일정이 {_dday_suffix(days_before)}"


def deadline_message(title: str, days_before: int) -> str:
    return f"{title} 마감이 {_dday_suffix(days_before)}"


def _settings_allows(db: Session, user_id: int, field: str) -> bool:
    setting = db.scalar(select(NotificationSetting).where(NotificationSetting.user_id == user_id))
    if setting is None:
        setting = NotificationSetting(user_id=user_id)
        db.add(setting)
        db.flush()
    return bool(getattr(setting, field))


def create_notification(
    db: Session,
    *,
    user_id: int | None,
    actor_id: int | None,
    notification_type: str,
    message: str,
    post_id: int | None = None,
    event_id: int | None = None,
    setting_field: str | None = None,
    dedupe_key: str | None = None,
) -> Notification | None:
    if user_id is None:
        return None
    if actor_id is not None and user_id == actor_id and not settings.notify_self:
        return None
    if dedupe_key and db.scalar(select(Notification.id).where(Notification.dedupe_key == dedupe_key)) is not None:
        return None
    if setting_field and not _settings_allows(db, user_id, setting_field):
        return None
    notification = Notification(
        user_id=user_id,
        notification_type=notification_type,
        message=message,
        post_id=post_id,
        event_id=event_id,
        dedupe_key=dedupe_key,
    )
    db.add(notification)
    db.flush()
    send_push_to_user(
        db,
        user_id,
        "AI·SW CAMPUS",
        message,
        {
            "notification_id": notification.id,
            "notification_type": notification_type,
            "post_id": post_id,
            "event_id": event_id,
        },
        notification_id=notification.id,
    )
    return notification


def notify_admins(
    db: Session,
    *,
    actor_id: int,
    notification_type: str,
    message: str,
    post_id: int | None = None,
) -> None:
    admin_ids = db.scalars(select(User.id).where(User.role == "admin", User.is_active.is_(True))).all()
    for admin_id in admin_ids:
        create_notification(
            db,
            user_id=admin_id,
            actor_id=actor_id,
            notification_type=notification_type,
            message=message,
            post_id=post_id,
            setting_field="notify_notice",
        )
