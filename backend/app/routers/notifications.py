import math

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.deps import get_current_user, get_db, require_admin
from app.errors import AppException
from app.models.event import Event
from app.models.notification import Notification, NotificationSetting, PushToken
from app.models.user import User
from app.response import success_response
from app.routers.events import openable_notice_post_ids
from app.schemas.notification import NotificationSettingUpdate, PushTokenRegister
from app.push import sync_push_receipts

router = APIRouter()


def _setting_payload(setting: NotificationSetting) -> dict:
    return {
        "notify_comment": setting.notify_comment,
        "notify_like": setting.notify_like,
        "notify_notice": setting.notify_notice,
        "notify_event": setting.notify_event,
        "notify_council": setting.notify_council,
    }


def _event_notice_post_ids(db: Session, notifications: list[Notification]) -> dict[int, int]:
    """일정 알림이 가리킬 공지를 누를 때 기준으로 찾는다.

    알림에 박아두지 않고 매번 조회하므로, 알림을 보낸 뒤에 관리자가 공지를 연결하거나
    바꿔도 그 알림이 최신 공지로 간다. 지워지거나 비공개가 된 공지는 빼고 준다.
    """

    event_ids = {item.event_id for item in notifications if item.event_id is not None}
    if not event_ids:
        return {}
    events = db.scalars(select(Event).where(Event.id.in_(event_ids))).all()
    openable = openable_notice_post_ids(db, events)
    return {
        event.id: event.notice_post_id
        for event in events
        if event.notice_post_id is not None and event.notice_post_id in openable
    }


def _notification_payload(notification: Notification, event_notices: dict[int, int] | None = None) -> dict:
    return {
        "id": notification.id,
        "notification_type": notification.notification_type,
        "message": notification.message,
        "post_id": notification.post_id,
        "event_id": notification.event_id,
        # 일정 알림을 눌렀을 때 열 공지. 없으면 눌러도 이동하지 않고 읽음 처리만 한다.
        "event_notice_post_id": (event_notices or {}).get(notification.event_id) if notification.event_id else None,
        "is_read": notification.is_read,
        "created_at": notification.created_at,
    }


def _get_or_create_setting(db: Session, user: User) -> NotificationSetting:
    setting = db.scalar(select(NotificationSetting).where(NotificationSetting.user_id == user.id))
    if setting is None:
        setting = NotificationSetting(user_id=user.id)
        db.add(setting)
        db.commit()
        db.refresh(setting)
    return setting


@router.get("")
def get_notifications(
    page: int = Query(1, ge=1),
    size: int = Query(30, ge=1, le=100),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    total = db.scalar(select(func.count(Notification.id)).where(Notification.user_id == user.id)) or 0
    notifications = db.scalars(
        select(Notification)
        .where(Notification.user_id == user.id)
        .order_by(Notification.created_at.desc(), Notification.id.desc())
        .offset((page - 1) * size)
        .limit(size)
    ).all()
    event_notices = _event_notice_post_ids(db, list(notifications))
    return success_response(
        [_notification_payload(notification, event_notices) for notification in notifications],
        pagination={"page": page, "size": size, "total": total, "total_pages": math.ceil(total / size) if total else 0},
    )


@router.put("/{notification_id}/read")
def mark_notification_read(
    notification_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    notification = db.get(Notification, notification_id)
    if notification is None or notification.user_id != user.id:
        raise AppException(status_code=404, message="Notification not found.", code="NOT_FOUND")

    notification.is_read = True
    db.commit()
    return success_response({"id": notification_id, "is_read": True})


@router.get("/settings/me")
def get_notification_settings(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    setting = _get_or_create_setting(db, user)
    return success_response(_setting_payload(setting))


@router.put("/settings/me")
def update_notification_settings(
    payload: NotificationSettingUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    setting = _get_or_create_setting(db, user)
    for key, value in payload.model_dump().items():
        setattr(setting, key, value)
    db.commit()
    db.refresh(setting)
    return success_response(_setting_payload(setting))


@router.post("/push-token")
def register_push_token(
    payload: PushTokenRegister,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    token = db.scalar(select(PushToken).where(PushToken.token == payload.token))
    if token is None:
        token = PushToken(user_id=user.id, token=payload.token, platform=payload.platform, is_active=True)
        db.add(token)
    else:
        token.user_id = user.id
        token.platform = payload.platform
        token.is_active = True
    db.commit()
    db.refresh(token)
    return success_response({"id": token.id, "registered": True})


@router.delete("/push-token")
def deactivate_push_token(
    payload: PushTokenRegister,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    token = db.scalar(select(PushToken).where(PushToken.token == payload.token, PushToken.user_id == user.id))
    if token is not None:
        token.is_active = False
        db.commit()
    return success_response({"registered": False})


@router.post("/admin/push-receipts/sync")
def sync_admin_push_receipts(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    return success_response(sync_push_receipts(db))
