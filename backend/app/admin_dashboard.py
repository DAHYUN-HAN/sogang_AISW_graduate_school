"""Protected daily content and first-party traffic read models."""

import math
from datetime import date, datetime, time, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.admin_main import KOREA, count, korea_day_range
from app.author_snapshots import resolve_author_display
from app.board_policies import hides_author_identity
from app.config import settings
from app.errors import AppException
from app.models.board import Board
from app.models.comment import Comment
from app.models.post import Post
from app.models.usage import UsagePageView
from app.models.user import User


def _selected_date(value: str | None, now: datetime) -> date:
    today = now.replace(tzinfo=timezone.utc).astimezone(KOREA).date()
    try:
        selected = date.fromisoformat(value) if value is not None else today
        # The complete seven-day UTC range must fit Python's datetime domain.
        korea_day_range(datetime.combine(selected - timedelta(days=6), time.min, tzinfo=KOREA))
    except (ValueError, OverflowError) as exc:
        raise AppException(422, "A valid YYYY-MM-DD dashboard date is required.", "VALIDATION_ERROR") from exc
    if selected > today:
        raise AppException(422, "Dashboard date cannot be in the future.", "VALIDATION_ERROR")
    return selected


def _day_range(day: date) -> tuple[datetime, datetime]:
    return korea_day_range(datetime.combine(day, time.min, tzinfo=KOREA))


def _day_filters(created_at, *, start: datetime, end: datetime, now: datetime) -> list:
    return [created_at >= start, created_at < end, created_at <= now]


def _traffic_day(db: Session, *, day: date, now: datetime, started_at: datetime | None) -> dict:
    start, end = _day_range(day)
    available = settings.usage_tracking_enabled and started_at is not None and started_at < end and started_at <= now
    if not available:
        return {"date": day.isoformat(), "visits": None, "visitors": None, "page_views": None}
    visits, visitors, page_views = db.execute(
        select(
            func.count(func.distinct(UsagePageView.session_id)),
            func.count(func.distinct(UsagePageView.visitor_key)),
            func.count(UsagePageView.event_id),
        ).where(*_day_filters(UsagePageView.created_at, start=start, end=end, now=now))
    ).one()
    return {"date": day.isoformat(), "visits": visits, "visitors": visitors, "page_views": page_views}


def _author_fields(item: Post | Comment, post: Post, board: Board, nickname: str | None, cohort: str | None) -> dict:
    # Dashboard drilldown also protects identities on anonymous parent posts.
    if post.is_anonymous or board.board_type == "suggestion" or hides_author_identity(board):
        return {"author_label": "익명", "author_cohort": None}
    author = resolve_author_display(
        live_nickname=nickname, live_cohort=cohort,
        snapshot_nickname=item.author_nickname_snapshot, snapshot_cohort=item.author_cohort_snapshot,
    )
    return {"author_label": author.nickname, "author_cohort": author.cohort}


def _page(items: list[dict], *, total: int, page: int, size: int) -> dict:
    return {"items": items, "total": total, "page": page, "size": size,
            "total_pages": math.ceil(total / size) if total else 0}


def dashboard_overview(
    db: Session, *, now: datetime, selected_date: str | None, post_page: int, comment_page: int, size: int,
) -> dict:
    now = now.astimezone(timezone.utc).replace(tzinfo=None) if now.tzinfo is not None else now
    selected = _selected_date(selected_date, now)
    start, end = _day_range(selected)
    yesterday = start - timedelta(days=1)
    post_base = [Post.deleted_at.is_(None), Post.status == "published"]
    post_filters = [*post_base, *_day_filters(Post.created_at, start=start, end=end, now=now)]
    comment_filters = _day_filters(Comment.created_at, start=start, end=end, now=now)
    posts_total = count(db, select(func.count(Post.id)).where(*post_filters))
    comments_total = count(db, select(func.count(Comment.id)).where(*comment_filters))
    started_at = db.scalar(select(func.min(UsagePageView.created_at)))
    trend = [_traffic_day(db, day=selected - timedelta(days=offset), now=now, started_at=started_at)
             for offset in range(6, -1, -1)]
    selected_traffic = trend[-1]
    posts = db.execute(
        select(Post, Board, User.nickname, User.cohort)
        .join(Board, Board.id == Post.board_id)
        .outerjoin(User, User.id == Post.author_id)
        .where(*post_filters)
        .order_by(Post.created_at.desc(), Post.id.desc())
        .offset((post_page - 1) * size).limit(size)
    ).all()
    comments = db.execute(
        select(Comment, Post, Board, User.nickname, User.cohort)
        .join(Post, Post.id == Comment.post_id)
        .join(Board, Board.id == Post.board_id)
        .outerjoin(User, User.id == Comment.author_id)
        .where(*comment_filters)
        .order_by(Comment.created_at.desc(), Comment.id.desc())
        .offset((comment_page - 1) * size).limit(size)
    ).all()
    return {
        "date": selected.isoformat(), "as_of": now,
        "metrics": {
            "visits_today": selected_traffic["visits"],
            "visitors_today": selected_traffic["visitors"],
            "page_views_today": selected_traffic["page_views"],
            "posts_today": posts_total,
            "posts_yesterday": count(db, select(func.count(Post.id)).where(
                *post_base, Post.created_at >= yesterday, Post.created_at < start,
            )),
            "comments_today": comments_total,
            "comments_yesterday": count(db, select(func.count(Comment.id)).where(
                Comment.created_at >= yesterday, Comment.created_at < start,
            )),
        },
        "traffic": {"status": "disabled" if not settings.usage_tracking_enabled else "collecting" if started_at else "not_started",
                    "started_at": started_at},
        "trend": trend,
        "posts": _page([
            {"id": post.id, "board_id": post.board_id, "board_name": board.name, "title": post.title,
             **_author_fields(post, post, board, nickname, cohort), "created_at": post.created_at}
            for post, board, nickname, cohort in posts
        ], total=posts_total, page=post_page, size=size),
        "comments": _page([
            {"id": comment.id, "post_id": comment.post_id, "board_id": post.board_id, "post_title": post.title,
             **_author_fields(comment, post, board, nickname, cohort), "content": comment.content,
             "created_at": comment.created_at}
            for comment, post, board, nickname, cohort in comments
        ], total=comments_total, page=comment_page, size=size),
    }
