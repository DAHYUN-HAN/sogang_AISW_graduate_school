import math
from datetime import timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.deps import get_db, require_admin
from app.models.audit import LegacyImportRecord, OperationalAuditLog
from app.models.comment import Comment
from app.models.event import Event
from app.models.notification import PushDelivery, PushToken
from app.models.post import Post
from app.models.report import Report
from app.models.user import User
from app.response import success_response
from app.security import utc_now
from app.admin_main import main_overview
from app.admin_dashboard import dashboard_overview


router = APIRouter()


@router.get("/dashboard")
def get_admin_dashboard(
    date: str | None = Query(None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
    post_page: int = Query(1, ge=1),
    comment_page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    return success_response(dashboard_overview(
        db, now=utc_now(), selected_date=date, post_page=post_page, comment_page=comment_page, size=size,
    ))


@router.get("/main")
def get_admin_main(
    mutual_page: int = Query(1, ge=1),
    suggestion_page: int = Query(1, ge=1),
    size: int = Query(5, ge=1, le=50),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    return success_response(main_overview(db, now=utc_now(), mutual_page=mutual_page, suggestion_page=suggestion_page, size=size))


def _count(db: Session, statement) -> int:
    return int(db.scalar(statement) or 0)


@router.get("/stats")
def get_admin_stats(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    thirty_days_ago = utc_now() - timedelta(days=30)
    return success_response(
        {
            "users_total": _count(db, select(func.count(User.id))),
            "users_active": _count(db, select(func.count(User.id)).where(User.is_active.is_(True))),
            "users_active_30d": _count(
                db,
                select(func.count(User.id)).where(User.last_login_at >= thirty_days_ago, User.is_active.is_(True)),
            ),
            "admins": _count(db, select(func.count(User.id)).where(User.role == "admin", User.is_active.is_(True))),
            "posts": _count(db, select(func.count(Post.id)).where(Post.deleted_at.is_(None))),
            "notices": _count(
                db,
                select(func.count(Post.id)).where(Post.deleted_at.is_(None), Post.is_notice.is_(True)),
            ),
            "comments": _count(db, select(func.count(Comment.id))),
            "events": _count(db, select(func.count(Event.id))),
            "open_reports": _count(db, select(func.count(Report.id)).where(Report.status.in_(["open", "reviewing"]))),
            "active_push_tokens": _count(
                db,
                select(func.count(PushToken.id)).where(PushToken.is_active.is_(True)),
            ),
            "push_failed": _count(db, select(func.count(PushDelivery.id)).where(PushDelivery.status == "failed")),
        }
    )


@router.get("/audit-logs")
def get_audit_logs(
    page: int = Query(1, ge=1),
    size: int = Query(30, ge=1, le=100),
    action: str | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    filters = [OperationalAuditLog.action == action] if action else []
    total = _count(db, select(func.count(OperationalAuditLog.id)).where(*filters))
    rows = db.execute(
        select(OperationalAuditLog, User.nickname)
        .outerjoin(User, User.id == OperationalAuditLog.actor_id)
        .where(*filters)
        .order_by(OperationalAuditLog.created_at.desc(), OperationalAuditLog.id.desc())
        .offset((page - 1) * size)
        .limit(size)
    ).all()
    return success_response(
        [
            {
                "id": item.id,
                "actor_id": item.actor_id,
                "actor_nickname": actor_nickname or "system",
                "action": item.action,
                "target_type": item.target_type,
                "target_id": item.target_id,
                "details": item.details,
                "created_at": item.created_at,
            }
            for item, actor_nickname in rows
        ],
        pagination={
            "page": page,
            "size": size,
            "total": total,
            "total_pages": math.ceil(total / size) if total else 0,
        },
    )


@router.get("/legacy-import/summary")
def get_legacy_import_summary(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    rows = db.execute(
        select(
            LegacyImportRecord.entity_type,
            LegacyImportRecord.status,
            LegacyImportRecord.action,
            func.count(LegacyImportRecord.id),
        )
        .group_by(
            LegacyImportRecord.entity_type,
            LegacyImportRecord.status,
            LegacyImportRecord.action,
        )
        .order_by(
            LegacyImportRecord.entity_type,
            LegacyImportRecord.status,
            LegacyImportRecord.action,
        )
    ).all()
    return success_response(
        [
            {"entity_type": entity_type, "status": status, "action": action, "count": count}
            for entity_type, status, action, count in rows
        ]
    )


@router.get("/legacy-import/records")
def get_legacy_import_records(
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
    status: str | None = None,
    entity_type: str | None = None,
    source_id: str | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    filters = []
    if status:
        filters.append(LegacyImportRecord.status == status)
    if entity_type:
        filters.append(LegacyImportRecord.entity_type == entity_type)
    if source_id:
        filters.append(LegacyImportRecord.source_id == source_id)
    total = _count(db, select(func.count(LegacyImportRecord.id)).where(*filters))
    records = db.scalars(
        select(LegacyImportRecord)
        .where(*filters)
        .order_by(LegacyImportRecord.updated_at.desc(), LegacyImportRecord.id.desc())
        .offset((page - 1) * size)
        .limit(size)
    ).all()
    return success_response(
        [
            {
                "id": record.id,
                "source_file": record.source_file,
                "source_sheet": record.source_sheet,
                "source_row": record.source_row,
                "entity_type": record.entity_type,
                "source_id": record.source_id,
                "source_parent_id": record.source_parent_id,
                "source_hash": record.source_hash,
                "action": record.action,
                "status": record.status,
                "target_table": record.target_table,
                "target_id": record.target_id,
                "reason": record.reason,
                "redacted_details": record.redacted_details,
                "created_at": record.created_at,
                "updated_at": record.updated_at,
            }
            for record in records
        ],
        pagination={
            "page": page,
            "size": size,
            "total": total,
            "total_pages": math.ceil(total / size) if total else 0,
        },
    )
