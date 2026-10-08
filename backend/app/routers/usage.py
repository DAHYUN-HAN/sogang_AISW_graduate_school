"""Authenticated, bounded first-party navigation events; no raw URLs or IPs."""
from datetime import timedelta
from typing import Literal
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.deps import get_current_user, get_db
from app.errors import AppException
from app.models.usage import UsagePageView
from app.models.user import User
from app.rate_limit import enforce_rate_limit
from app.response import success_response
from app.security import utc_now
from app.usage_identity import usage_visitor_key

router = APIRouter()


class PageViewCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    event_id: UUID
    device_id: UUID
    screen: Literal["home", "notices", "community", "participation", "council", "board", "post", "settings", "search", "notifications", "faq"]


@router.post("/page-views")
def record_page_view(payload: PageViewCreate, request: Request, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role == "admin" or not settings.usage_tracking_enabled:
        return success_response({"accepted": False})
    enforce_rate_limit(request, action="usage.page_view", subject=str(current_user.id), limit=120, ip_limit=360, window_seconds=300)
    visitor = usage_visitor_key(current_user.id)
    # Serialize events for a principal across devices on PostgreSQL, including retry checks.
    principal = db.execute(select(User.id, User.role, User.is_active).where(User.id == current_user.id).with_for_update()).first()
    if principal is None or not principal.is_active:
        raise AppException(status_code=401, message="Authentication is required.", code="UNAUTHORIZED")
    if principal.role == "admin":
        return success_response({"accepted": False})
    event_id, device_id = str(payload.event_id), str(payload.device_id)
    existing = db.get(UsagePageView, event_id)
    if existing:
        if existing.visitor_key != visitor or existing.device_id != device_id:
            raise AppException(status_code=409, message="Event identity conflict.", code="EVENT_CONFLICT")
        return success_response({"accepted": True})
    now = utc_now()
    last = db.scalar(select(UsagePageView).where(UsagePageView.visitor_key == visitor, UsagePageView.device_id == device_id)
                     .order_by(UsagePageView.created_at.desc()).limit(1))
    session_id = last.session_id if last and last.created_at > now - timedelta(minutes=30) else str(uuid4())
    db.add(UsagePageView(event_id=event_id, device_id=device_id, visitor_key=visitor, session_id=session_id, screen=payload.screen, created_at=now))
    db.commit()
    return success_response({"accepted": True})
