from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.deps import get_current_user, get_db, require_admin
from app.errors import AppException
from app.models.event import Event
from app.models.board import Board
from app.models.post import Post
from app.models.user import User
from app.notifications import create_notification, event_message
from app.audit import log_admin_action
from app.response import success_response
from app.schemas.event import EventCreate, EventUpdate

router = APIRouter()
KOREA_TIME_ZONE = ZoneInfo("Asia/Seoul")


def _korea_date_boundary(value: date) -> datetime:
    return (
        datetime.combine(value, time.min, tzinfo=KOREA_TIME_ZONE)
        .astimezone(timezone.utc)
        .replace(tzinfo=None)
    )


def _utc_naive(value: datetime | None) -> datetime | None:
    if value is None or value.tzinfo is None:
        return value
    return value.astimezone(timezone.utc).replace(tzinfo=None)


def _event_write_payload(payload: EventCreate | EventUpdate) -> dict:
    data = payload.model_dump()
    data["start_at"] = _utc_naive(data["start_at"])
    data["end_at"] = _utc_naive(data["end_at"])
    return data


def _dispatch_for_date(db: Session, target_date: date) -> dict:
    # 일정 알림은 당일(D-day)에만 보낸다. 공지 마감 알림은 보내지 않는다.
    created = 0
    active_user_ids = db.scalars(select(User.id).where(User.is_active.is_(True))).all()
    window_start = _korea_date_boundary(target_date)
    window_end = _korea_date_boundary(target_date + timedelta(days=1))
    events = db.scalars(
        select(Event).where(Event.start_at >= window_start, Event.start_at < window_end)
    ).all()
    for event in events:
        message = event_message(event.title, 0)
        for user_id in active_user_ids:
            notification = create_notification(
                db,
                user_id=user_id,
                actor_id=None,
                notification_type="event",
                message=message,
                event_id=event.id,
                setting_field="notify_event",
                dedupe_key=f"event-reminder:{event.id}:D-day:{user_id}",
            )
            if notification is not None:
                created += 1
    db.commit()
    return {"target_date": target_date.isoformat(), "created": created}


def openable_notice_post_ids(db: Session, events) -> set[int]:
    """연계 공지 중 지금 실제로 열리는 글만 남긴다.

    공지가 지워지거나 비공개로 바뀌면 화면에 화살표만 남고 눌러도 아무것도 안 열린다.
    목록에서도 한 번에 조회해 일정 수만큼 질의가 늘지 않게 한다.
    """

    candidates = {event.notice_post_id for event in events if event.notice_post_id is not None}
    if not candidates:
        return set()
    return set(
        db.scalars(
            select(Post.id)
            .join(Board, Board.id == Post.board_id)
            .where(
                Post.id.in_(candidates),
                Post.status == "published",
                Post.deleted_at.is_(None),
                Board.is_active.is_(True),
            )
        ).all()
    )


def _event_payload(event: Event, openable_notice_ids: set[int] | None = None) -> dict:
    notice_post_id = event.notice_post_id
    if notice_post_id is not None and openable_notice_ids is not None and notice_post_id not in openable_notice_ids:
        notice_post_id = None
    return {
        "id": event.id,
        "title": event.title,
        "description": event.description,
        "location": event.location,
        "category": event.category,
        "color": event.color,
        "start_at": event.start_at,
        "end_at": event.end_at,
        "notice_post_id": notice_post_id,
        "created_by": event.created_by,
        "created_at": event.created_at,
        "updated_at": event.updated_at,
    }


@router.get("")
def get_events(
    from_date: date | None = Query(None),
    to_date: date | None = Query(None),
    category: str | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    filters = []
    if from_date is not None:
        # 종료일(없으면 시작일)이 조회 시작 이후면 포함 → 여러 날에 걸친 일정도 모든 날에 조회된다.
        filters.append(func.coalesce(Event.end_at, Event.start_at) >= _korea_date_boundary(from_date))
    if to_date is not None:
        exclusive_end = _korea_date_boundary(to_date + timedelta(days=1))
        filters.append(Event.start_at < exclusive_end)
    if category:
        filters.append(Event.category == category)

    events = db.scalars(select(Event).where(*filters).order_by(Event.start_at.asc(), Event.id.asc())).all()
    openable = openable_notice_post_ids(db, events)
    return success_response([_event_payload(event, openable) for event in events])


@router.post("/admin/dispatch-reminders")
def dispatch_event_reminders(
    target_date: date | None = Query(None),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    result = _dispatch_for_date(db, target_date or datetime.now(ZoneInfo("Asia/Seoul")).date())
    log_admin_action(
        db,
        actor_id=admin.id,
        action="event.reminders.dispatch",
        target_type="event",
        details=result,
    )
    db.commit()
    return success_response(result)


@router.get("/{event_id}")
def get_event(event_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    event = db.get(Event, event_id)
    if event is None:
        raise AppException(status_code=404, message="Event not found.", code="NOT_FOUND")
    return success_response(_event_payload(event, openable_notice_post_ids(db, [event])))


@router.post("")
def create_event(payload: EventCreate, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    event = Event(**_event_write_payload(payload), created_by=admin.id)
    db.add(event)
    db.flush()
    log_admin_action(db, actor_id=admin.id, action="event.create", target_type="event", target_id=event.id)
    db.commit()
    db.refresh(event)
    return success_response(_event_payload(event, openable_notice_post_ids(db, [event])))


@router.put("/{event_id}")
def update_event(
    event_id: int,
    payload: EventUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    event = db.get(Event, event_id)
    if event is None:
        raise AppException(status_code=404, message="Event not found.", code="NOT_FOUND")

    for key, value in _event_write_payload(payload).items():
        setattr(event, key, value)
    log_admin_action(db, actor_id=admin.id, action="event.update", target_type="event", target_id=event.id)
    db.commit()
    db.refresh(event)
    return success_response(_event_payload(event, openable_notice_post_ids(db, [event])))


@router.delete("/{event_id}")
def delete_event(event_id: int, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    event = db.get(Event, event_id)
    if event is None:
        raise AppException(status_code=404, message="Event not found.", code="NOT_FOUND")

    log_admin_action(db, actor_id=admin.id, action="event.delete", target_type="event", target_id=event.id)
    db.delete(event)
    db.commit()
    return success_response({"id": event_id})
