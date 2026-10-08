"""Read models for the administrator's daily work overview."""

import math
from datetime import datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import and_, case, func, or_, select
from sqlalchemy.orm import Session

from app.models.board import Board
from app.models.comment import Comment
from app.models.post import Post
from app.models.post_extension import PostMutualAid, PostSuggestion
from app.models.report import Report
from app.models.user import User
from app.models.usage import UsagePageView
from app.config import settings

KOREA = ZoneInfo("Asia/Seoul")


def korea_day_range(now: datetime) -> tuple[datetime, datetime]:
    aware = now.replace(tzinfo=timezone.utc) if now.tzinfo is None else now
    midnight = datetime.combine(aware.astimezone(KOREA).date(), time.min, tzinfo=KOREA)
    start = midnight.astimezone(timezone.utc).replace(tzinfo=None)
    return start, start + timedelta(days=1)


def count(db: Session, statement) -> int:
    return int(db.scalar(statement) or 0)


def request_queue(db: Session, *, kind: str, now: datetime, page: int, size: int) -> dict:
    model = PostMutualAid if kind == "mutual_aid" else PostSuggestion
    pending_status = "processing" if kind == "mutual_aid" else "received"
    handled_statuses = ("completed", "rejected") if kind == "mutual_aid" else ("answered",)
    handled_at = model.reviewed_at if kind == "mutual_aid" else model.replied_at
    start, end = korea_day_range(now)
    pending = model.status == pending_status
    handled = and_(model.status.in_(handled_statuses), handled_at >= start, handled_at < end)
    base_filters = [Post.deleted_at.is_(None), Post.status == "published", Board.is_active.is_(True), Board.board_type == kind]
    base = select(Post, model, User.nickname, User.cohort).join(model, model.post_id == Post.id).join(Board, Board.id == Post.board_id).outerjoin(User, User.id == Post.author_id)
    count_base = select(func.count(Post.id)).join(model, model.post_id == Post.id).join(Board, Board.id == Post.board_id)
    pending_count = count(db, count_base.where(*base_filters, pending))
    today_handled_count = count(db, count_base.where(*base_filters, handled))
    total = pending_count + today_handled_count
    total_pages = math.ceil(total / size) if total else 0
    # Clamp pages after a mutation so removing the last item cannot leave an empty page.
    page = min(page, max(total_pages, 1))
    rows = db.execute(base.where(*base_filters, or_(pending, handled)).order_by(
        case((pending, 0), else_=1),
        case((pending, Post.created_at), else_=handled_at).desc(), Post.id.desc(),
    ).offset((page - 1) * size).limit(size)).all()
    return {
        "items": [{
            "id": post.id, "board_id": post.board_id, "kind": kind, "title": post.title,
            "status": extension.status,
            "author_label": "익명" if kind == "suggestion" else (nickname or post.author_nickname_snapshot or "탈퇴한 원우"),
            "author_cohort": None if kind == "suggestion" else (cohort or post.author_cohort_snapshot),
            "received_at": post.created_at,
            "handled_at": getattr(extension, "reviewed_at" if kind == "mutual_aid" else "replied_at"),
        } for post, extension, nickname, cohort in rows],
        "pending_count": pending_count, "today_handled_count": today_handled_count,
        "total": total, "page": page, "size": size, "total_pages": total_pages,
    }


def main_overview(db: Session, *, now: datetime, mutual_page: int, suggestion_page: int, size: int) -> dict:
    start, _ = korea_day_range(now)
    yesterday = start - timedelta(days=1)
    posts = select(func.count(Post.id)).where(Post.deleted_at.is_(None), Post.status == "published")
    comments = select(func.count(Comment.id))
    mutual = request_queue(db, kind="mutual_aid", now=now, page=mutual_page, size=size)
    suggestions = request_queue(db, kind="suggestion", now=now, page=suggestion_page, size=size)
    started_at = db.scalar(select(func.min(UsagePageView.created_at)))
    traffic_available = settings.usage_tracking_enabled and started_at is not None
    traffic_base = select(UsagePageView).where(UsagePageView.created_at >= start, UsagePageView.created_at <= now).subquery()
    traffic_metrics = {
        "visits_today": count(db, select(func.count(func.distinct(traffic_base.c.session_id)))) if traffic_available else None,
        "visitors_today": count(db, select(func.count(func.distinct(traffic_base.c.visitor_key)))) if traffic_available else None,
        "page_views_today": count(db, select(func.count()).select_from(traffic_base)) if traffic_available else None,
    }
    return {
        "date": (start.replace(tzinfo=timezone.utc).astimezone(KOREA)).date().isoformat(), "as_of": now,
        "metrics": {
            **traffic_metrics,
            "posts_today": count(db, posts.where(Post.created_at >= start, Post.created_at <= now)),
            "posts_yesterday": count(db, posts.where(Post.created_at >= yesterday, Post.created_at < start)),
            "comments_today": count(db, comments.where(Comment.created_at >= start, Comment.created_at <= now)),
            "comments_yesterday": count(db, comments.where(Comment.created_at >= yesterday, Comment.created_at < start)),
        },
        "traffic": {"status": "disabled" if not settings.usage_tracking_enabled else "collecting" if started_at else "not_started", "started_at": started_at},
        "pending": {"mutual_aid": mutual["pending_count"], "suggestions": suggestions["pending_count"],
                    "reports": count(db, select(func.count(Report.id)).where(Report.status.in_(["open", "reviewing"])))},
        "mutual_aid": mutual, "suggestions": suggestions,
    }
