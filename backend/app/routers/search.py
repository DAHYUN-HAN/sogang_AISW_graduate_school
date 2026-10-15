import math

from fastapi import APIRouter, Depends, Query
from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session

from app.author_snapshots import resolve_author_display
from app.board_policies import ANONYMOUS_BOARD_SLUGS
from app.deps import get_current_user, get_db
from app.models.board import Board
from app.models.post import Post
from app.models.search import SearchHistory
from app.models.user import User
from app.models.user_block import UserBlock
from app.post_access import post_read_filter
from app.response import success_response
from app.routers.posts import _highlight
from app.text_search import contains, search_pattern

router = APIRouter()


@router.get("")
def search(
    q: str = Query(..., min_length=1),
    scope: str = Query("all", pattern="^(all|board|notices|community|participation|council|resources)$"),
    board_id: int | None = None,
    notice_category: str | None = Query(None, pattern="^(academic|event|other)$"),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    keyword = search_pattern(q)
    if keyword is None:
        return success_response([], pagination={"page": page, "size": size, "total": 0, "total_pages": 0})
    filters = [Post.deleted_at.is_(None), post_read_filter(current_user)]
    if scope == "board" and board_id is not None:
        filters.append(Post.board_id == board_id)
    elif scope != "all":
        filters.append(Board.category == scope)
    if scope == "notices" and notice_category == "academic":
        filters.append(
            or_(
                Board.slug.in_(["academic-notices", "academic-calendar"]),
                func.lower(func.coalesce(Post.category, "")).in_(["academic", "academic-notice"]),
                Post.category.ilike("%학사%"),
            )
        )
    elif scope == "notices" and notice_category == "event":
        filters.append(
            or_(
                Board.slug.in_(["event-notices", "webinar-notices"]),
                func.lower(func.coalesce(Post.category, "")).in_(["event", "webinar", "event-notice"]),
                Post.category.ilike("%행사%"),
                Post.category.ilike("%특강%"),
            )
        )
    elif scope == "notices" and notice_category == "other":
        filters.extend(
            [
                Board.slug == "all-notices",
                or_(
                    func.lower(func.coalesce(Post.category, "")) == "other",
                    Post.category.ilike("%기타%"),
                ),
            ]
        )
    blocked_author_ids = db.scalars(
        select(UserBlock.blocked_user_id).where(UserBlock.blocker_id == current_user.id)
    ).all()
    if blocked_author_ids:
        filters.append(
            or_(
                Post.is_anonymous.is_(True),
                Board.slug.in_(ANONYMOUS_BOARD_SLUGS),
                Post.author_id.is_(None),
                Post.author_id.not_in(blocked_author_ids),
            )
        )

    if current_user.role == "admin":
        filters.append(
            contains(Post.title, keyword)
            | contains(Post.content, keyword)
            | contains(User.nickname, keyword)
            | contains(Post.author_nickname_snapshot, keyword)
        )
    else:
        filters.append(
            or_(
                contains(Post.title, keyword),
                contains(Post.content, keyword),
                and_(
                    Post.is_anonymous.is_(False),
                    Board.slug.not_in(ANONYMOUS_BOARD_SLUGS),
                    or_(
                        contains(User.nickname, keyword),
                        contains(Post.author_nickname_snapshot, keyword),
                    ),
                ),
            )
        )

    total = (
        db.scalar(
            select(func.count(Post.id))
            .select_from(Post)
            .join(Board, Board.id == Post.board_id)
            .outerjoin(User, User.id == Post.author_id)
            .where(*filters)
        )
        or 0
    )
    total_pages = math.ceil(total / size) if total > 0 else 0

    rows = db.execute(
        select(Post, Board.name, Board.slug, User.nickname, User.cohort)
        .join(Board, Board.id == Post.board_id)
        .outerjoin(User, User.id == Post.author_id)
        .where(*filters)
        .order_by(Post.created_at.desc(), Post.id.desc())
        .offset((page - 1) * size)
        .limit(size)
    ).all()

    db.add(SearchHistory(user_id=current_user.id, keyword=q))
    db.commit()

    data = [
        {
            "type": "post",
            "id": post.id,
            "board_id": post.board_id,
            "board_name": board_name,
            "board_slug": board_slug,
            "category": post.category,
            "title": post.title,
            "content_preview": post.content[:100],
            "author_nickname": (
                "Anonymous"
                if (post.is_anonymous and current_user.role != "admin")
                or (board_slug in ANONYMOUS_BOARD_SLUGS and current_user.role != "admin")
                else resolve_author_display(
                    live_nickname=nickname,
                    live_cohort=cohort,
                    snapshot_nickname=post.author_nickname_snapshot,
                    snapshot_cohort=post.author_cohort_snapshot,
                ).nickname
            ),
            "author_cohort": None
            if (post.is_anonymous and current_user.role != "admin")
            or (board_slug in ANONYMOUS_BOARD_SLUGS and current_user.role != "admin")
            else resolve_author_display(
                live_nickname=nickname,
                live_cohort=cohort,
                snapshot_nickname=post.author_nickname_snapshot,
                snapshot_cohort=post.author_cohort_snapshot,
            ).cohort,
            "created_at": post.created_at,
            "highlights": {
                "title": _highlight(post.title, q),
                "content_preview": _highlight(post.content[:100], q),
            },
        }
        for post, board_name, board_slug, nickname, cohort in rows
    ]

    return success_response(
        data,
        pagination={
            "page": page,
            "size": size,
            "total": total,
            "total_pages": total_pages,
        },
    )


@router.get("/recent")
def recent_searches(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rows = db.scalars(
        select(SearchHistory)
        .where(SearchHistory.user_id == current_user.id)
        .order_by(SearchHistory.created_at.desc(), SearchHistory.id.desc())
        .limit(10)
    ).all()

    return success_response([{"keyword": row.keyword, "searched_at": row.created_at} for row in rows])
