import math
from datetime import date, datetime, timedelta, timezone
from urllib.parse import urlparse
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import String, and_, case, cast, func, or_, select, update
from sqlalchemy.orm import Session, aliased

from app.author_snapshots import resolve_author_display
from app.board_policies import ANONYMOUS_BOARD_SLUGS, canonical_post_category, hides_author_identity
from app.deps import can_read_board, can_write_board, get_current_user, get_db, require_admin
from app.errors import AppException
from app.models.board import Board
from app.models.bookmark import Bookmark
from app.models.dues_payment import DuesPayment
from app.models.like import Like
from app.models.media import MediaAsset, PostAttachment
from app.models.post import Post
from app.models.post_extension import PostMutualAid, PostSuggestion
from app.models.student_roster import StudentRosterMember
from app.models.user import User
from app.models.user_block import UserBlock
from app.notifications import (
    ADMIN_REPLY_MESSAGE,
    MUTUAL_AID_MESSAGES,
    create_notification,
    like_message,
    notice_message,
)
from app.post_access import post_status_read_filter, require_post_read
from app.response import success_response
from app.rate_limit import enforce_rate_limit
from app.schemas.post import MutualAidUpdate, PostCreate, PostRepresentativeImageUpdate, PostUpdate, SuggestionUpdate
from app.security import utc_now
from app.study_activity_cleanup import post_content_preview
from app.audit import log_admin_action
from app.participation_guides import ADMIN_PARTICIPATION_BOARD_SLUGS, normalize_participation_guide

router = APIRouter()

COUNCIL_MEMBER_WRITABLE_TYPES = frozenset({"suggestion", "mutual_aid"})
PHOTO_ALBUM_ATTACHMENT_LIMIT = 20
MUTUAL_AID_MIN_LEAD_DAYS = 0
SEOUL_TIME_ZONE = ZoneInfo("Asia/Seoul")


def _safe_metadata(
    post: Post, board: Board, *, include_sensitive: bool = False, include_bank_account: bool = False
) -> dict | None:
    _, normalized = normalize_participation_guide(board.slug, post.content, post.metadata_json)
    if not normalized:
        return None
    metadata = dict(normalized)
    if board.board_type == "activity_certification" and not (include_sensitive or include_bank_account):
        metadata.pop("bank_account", None)
    if board.slug == "study-activity" and not include_sensitive:
        metadata.pop("legacy_original_title", None)
    return metadata


def _visible_post_content(post: Post, board: Board) -> str:
    content, _ = normalize_participation_guide(board.slug, post.content, post.metadata_json)
    return content


def _participant_label(payer: StudentRosterMember) -> str:
    # 학번 A73006의 A 다음 두 자리가 기수 → "73기 홍길동"으로 표기한다.
    # ponytail: 기수 2자리(99기까지)는 학번 체계(A+5자리)의 한계 — 100기부터는 학번 형식이
    # 바뀌어야 하며, 그 경우 이 규칙에 안 걸려 이름만 표기된다(오파싱 없음). 형식 확정 시 갱신.
    number = payer.student_number or ""
    if len(number) == 6 and number[0] == "A" and number[1:].isdigit():
        return f"{int(number[1:3])}기 {payer.name}"
    return payer.name


def _dues_paid_snapshot(db: Session, board: Board, payer_ids: list[int]) -> list[bool]:
    """글을 쓰거나 고친 시점의 납부 여부를 그대로 굳혀 둔다.

    지원금은 활동 당시 기준으로 지급하므로, 1학기에 미납이던 참가자가 2학기에
    납부했다고 해서 1학기 글의 표시가 바뀌면 안 된다.
    """
    payments = {
        payment.roster_member_id: payment
        for payment in db.scalars(
            select(DuesPayment).where(DuesPayment.roster_member_id.in_(payer_ids))
        ).all()
    }
    return [
        bool(
            (payment := payments.get(payer_id))
            and (payment.scope == "ALL" or payment.once_board_id == board.id)
        )
        for payer_id in payer_ids
    ]


def _stored_dues_snapshot(metadata: dict, expected: int) -> list[bool] | None:
    snapshot = metadata.get("participant_dues_paid")
    if (
        isinstance(snapshot, list)
        and len(snapshot) == expected
        and all(isinstance(paid, bool) for paid in snapshot)
    ):
        return snapshot
    return None


def _activity_participant_details(db: Session, board: Board, post: Post) -> list[dict] | None:
    if board.board_type != "activity_certification":
        return None

    metadata = dict(post.metadata_json or {})
    raw_labels = metadata.get("participants")
    labels = (
        [label.strip() for label in raw_labels.split(",") if label.strip()]
        if isinstance(raw_labels, str)
        else []
    )
    payer_ids = metadata.get("participant_dues_payer_ids")
    if (
        not isinstance(payer_ids, list)
        or len(payer_ids) != len(labels)
        or any(not isinstance(payer_id, int) or isinstance(payer_id, bool) for payer_id in payer_ids)
    ):
        return [
            {"id": None, "label": label, "is_paid_for_board": None}
            for label in labels
        ]

    # 작성·수정 시점에 굳혀 둔 값이 있으면 그대로 쓴다. 그 뒤 납부 상태가 바뀌어도
    # 지난 글의 표시는 그대로여야 한다.
    #
    # 스냅샷을 쓰기 전에 올라온 글은 당시 납부 상태를 알 방법이 없다. dues_payments는
    # 회원당 한 행이고 미납으로 되돌리면 행이 지워지며, 감사 로그도 변경 후 값만
    # 남긴다. 그래서 지금 상태로 계산하지 않고 '모름'(null)으로 둔다. 화면은 명시적인
    # false일 때만 회색이므로 이름만 있던 옛 글과 같이 검은색으로 고정된다.
    snapshot = _stored_dues_snapshot(metadata, len(payer_ids))
    return [
        {
            "id": payer_id,
            "label": label,
            "is_paid_for_board": snapshot[index] if snapshot is not None else None,
        }
        for index, (payer_id, label) in enumerate(zip(payer_ids, labels, strict=True))
    ]


def _invalid_dues_payer() -> AppException:
    return AppException(
        status_code=422,
        message="Select every participant from the full student roster.",
        code="INVALID_DUES_PAYER",
    )


def _invalid_activity_source() -> AppException:
    return AppException(
        status_code=422,
        message="Select a current club registered by an administrator.",
        code="INVALID_ACTIVITY_SOURCE",
    )


def _activity_source_post_id(metadata: dict | None) -> int | None:
    value = (metadata or {}).get("activity_source_post_id")
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value if value > 0 else None
    if not isinstance(value, str):
        return None
    normalized = value.strip()
    if not normalized.isdecimal():
        return None
    parsed = int(normalized)
    return parsed if parsed > 0 else None


def _canonical_club_activity_source(
    db: Session,
    board: Board | None,
    metadata: dict | None,
    *,
    existing_metadata: dict | None = None,
) -> tuple[dict | None, str | None]:
    if board is None or board.slug != "club-activity":
        return metadata, None

    canonical = dict(metadata or {})
    source_id = _activity_source_post_id(canonical)
    if source_id is None:
        raise _invalid_activity_source()

    existing_source_id = _activity_source_post_id(existing_metadata)
    filters = [Post.id == source_id, Board.slug == "club-promo"]
    if source_id != existing_source_id:
        filters.extend(
            [
                Board.is_active.is_(True),
                Post.status == "published",
                Post.deleted_at.is_(None),
            ]
        )
    source = db.scalar(select(Post).join(Board, Board.id == Post.board_id).where(*filters))
    if source is None:
        raise _invalid_activity_source()
    if source_id != existing_source_id and (source.metadata_json or {}).get("club_operation_status") == "ended":
        raise _invalid_activity_source()

    canonical["activity_source_post_id"] = str(source_id)
    return canonical, source.title


def _club_activity_source_titles(db: Session, board: Board | None, posts: list[Post]) -> dict[int, str]:
    if board is None or board.slug != "club-activity":
        return {}
    source_ids = {
        source_id
        for post in posts
        if (source_id := _activity_source_post_id(post.metadata_json)) is not None
    }
    if not source_ids:
        return {}
    rows = db.execute(
        select(Post.id, Post.title)
        .join(Board, Board.id == Post.board_id)
        .where(Post.id.in_(source_ids), Board.slug == "club-promo")
    ).all()
    return {source_id: title for source_id, title in rows}


def _activity_certification_search_filter(board: Board, keyword: str):
    text_match = Post.title.ilike(keyword) | Post.content.ilike(keyword)
    # Study cards display a title without an activity badge.
    if board.slug == "study-activity":
        return text_match

    category = func.nullif(func.trim(Post.category), "")
    if board.slug != "club-activity":
        return text_match | func.coalesce(category, "활동 인증").ilike(keyword)

    # Match the displayed club badge: current source title, category, legacy name.
    # Compare IDs as text so malformed legacy metadata cannot cause a SQL cast error.
    source = aliased(Post)
    source_id = func.ltrim(
        func.trim(cast(Post.metadata_json["activity_source_post_id"].as_string(), String)), "0",
    )
    source_title = (
        select(func.nullif(func.trim(source.title), ""))
        .join(Board, Board.id == source.board_id)
        .where(cast(source.id, String) == source_id, Board.slug == "club-promo")
        .correlate(Post)
        .scalar_subquery()
    )
    generic_labels = ("동아리 활동 인증", "활동 인증", "안내")
    legacy_name = func.nullif(func.trim(Post.metadata_json["legacy_activity_name"].as_string()), "")
    badge = func.coalesce(
        source_title,
        case((category.not_in(generic_labels), category)),
        case((legacy_name.not_in(generic_labels), legacy_name)),
        "동아리 활동 인증",
    )
    return text_match | badge.ilike(keyword)


def _canonical_activity_metadata(
    db: Session,
    board: Board | None,
    incoming_metadata: dict | None,
    *,
    existing_metadata: dict | None = None,
) -> dict | None:
    if board is None or board.board_type != "activity_certification":
        return incoming_metadata

    metadata = dict(incoming_metadata or {})
    existing = dict(existing_metadata or {})
    if "participant_dues_payer_ids" not in metadata:
        if not existing:
            raise _invalid_dues_payer()

        existing_participants = existing.get("participants")
        incoming_participants = metadata.get("participants", existing_participants)
        if not isinstance(existing_participants, str) or incoming_participants != existing_participants:
            raise _invalid_dues_payer()

        metadata["participants"] = existing_participants
        if "participant_dues_payer_ids" in existing:
            metadata["participant_dues_payer_ids"] = existing["participant_dues_payer_ids"]
            # 참가자를 그대로 둔 수정이면 굳혀 둔 납부 여부도 그대로 이어받는다.
            # 다른 칸만 고쳤다고 지난 글의 표시가 바뀌면 안 된다.
            if "participant_dues_paid" in existing:
                metadata["participant_dues_paid"] = existing["participant_dues_paid"]
        elif "participant_user_ids" in existing:
            metadata["participant_user_ids"] = existing["participant_user_ids"]
        return metadata

    payer_ids = metadata.get("participant_dues_payer_ids")
    if (
        not isinstance(payer_ids, list)
        or not payer_ids
        or any(not isinstance(payer_id, int) or isinstance(payer_id, bool) or payer_id <= 0 for payer_id in payer_ids)
        or len(set(payer_ids)) != len(payer_ids)
    ):
        raise _invalid_dues_payer()

    payers_by_id = {
        payer.id: payer
        for payer in db.scalars(
            select(StudentRosterMember).where(StudentRosterMember.id.in_(payer_ids))
        ).all()
    }
    if len(payers_by_id) != len(payer_ids):
        raise _invalid_dues_payer()

    metadata["participants"] = ", ".join(_participant_label(payers_by_id[payer_id]) for payer_id in payer_ids)
    metadata["participant_dues_payer_ids"] = payer_ids
    # 참가자를 새로 정한 시점의 납부 여부를 굳힌다. 클라이언트가 보낸 값은 믿지 않고
    # 서버가 직접 계산한다.
    metadata["participant_dues_paid"] = _dues_paid_snapshot(db, board, payer_ids)
    metadata.pop("participant_user_ids", None)
    return metadata


def _metadata_for_update(
    post: Post,
    board: Board | None,
    incoming_metadata: dict | None,
    *,
    has_new_attachments: bool = False,
) -> dict | None:
    metadata = dict(incoming_metadata or {})
    existing_metadata = dict(post.metadata_json or {})
    if (
        board is not None
        and board.slug == "club-promo"
        and "club_operation_status" in existing_metadata
        and "club_operation_status" not in metadata
    ):
        metadata["club_operation_status"] = existing_metadata["club_operation_status"]
    if (
        board is not None
        and board.board_type == "activity_certification"
        and "bank_account" in existing_metadata
        and "bank_account" not in metadata
    ):
        metadata["bank_account"] = existing_metadata["bank_account"]
    if (
        board is not None
        and board.board_type == "mutual_aid"
        and not has_new_attachments
        and "proof_url" in existing_metadata
        and "proof_url" not in metadata
    ):
        metadata["proof_url"] = existing_metadata["proof_url"]
    return metadata or None


def _hide_post_author(post: Post, board: Board, current_user: User) -> bool:
    return current_user.role != "admin" and (post.is_anonymous or hides_author_identity(board))


def _visible_post_author_id(post: Post, board: Board, current_user: User) -> int | None:
    if post.author_id is None:
        return None
    if _hide_post_author(post, board, current_user) and post.author_id != current_user.id:
        return None
    return post.author_id


def _post_author_nickname(
    post: Post,
    board: Board,
    current_user: User,
    nickname: str | None,
) -> str:
    if _hide_post_author(post, board, current_user):
        return "Anonymous"
    return resolve_author_display(
        live_nickname=nickname,
        live_cohort=None,
        snapshot_nickname=post.author_nickname_snapshot,
        snapshot_cohort=None,
    ).nickname


def _post_author_cohort(
    post: Post,
    board: Board,
    current_user: User,
    nickname: str | None,
    cohort: str | None,
) -> str | None:
    if _hide_post_author(post, board, current_user):
        return None
    return resolve_author_display(
        live_nickname=nickname,
        live_cohort=cohort,
        snapshot_nickname=post.author_nickname_snapshot,
        snapshot_cohort=post.author_cohort_snapshot,
    ).cohort


def _enforce_council_management_policy(board: Board, current_user: User) -> None:
    if board.category not in {"council", "gsa"} or board.board_type in COUNCIL_MEMBER_WRITABLE_TYPES:
        return
    if current_user.role != "admin":
        raise AppException(status_code=403, message="Only admins can manage council content.", code="FORBIDDEN")


def _validate_post_content(board: Board, content: str) -> None:
    if board.board_type == "mutual_aid" or content:
        return
    raise AppException(status_code=422, message="Post content is required.", code="VALIDATION_ERROR")


def _post_list_order(sort: str, *, pin_priority: bool = True):
    pin_order = (Post.is_pinned.desc(),) if pin_priority else ()
    if sort == "popular":
        return (
            *pin_order,
            Post.like_count.desc(),
            Post.comment_count.desc(),
            Post.created_at.desc(),
            Post.id.desc(),
        )
    if sort == "views":
        return (
            *pin_order,
            Post.view_count.desc(),
            Post.created_at.desc(),
            Post.id.desc(),
        )
    return (*pin_order, Post.created_at.desc(), Post.id.desc())


def _post_feed_scope_filter(scope: str):
    if scope == "notices":
        return Board.board_type == "notice"
    if scope == "resources":
        return Board.category == "resources"
    return or_(
        Board.slug.in_(["council-activity", "gsa-activity"]),
        and_(
            Board.board_type == "notice",
            Post.metadata_json["show_in_council_activity"].as_boolean().is_(True),
        ),
    )


def _post_feed_notice_category_expression():
    post_category = func.trim(func.coalesce(Post.category, ""))
    board_category = func.trim(func.coalesce(Board.slug, ""))
    normalized = func.lower(
        case(
            (post_category != "", post_category),
            else_=board_category,
        )
    )
    event_match = or_(
        normalized.contains("event"),
        normalized.contains("행사"),
        normalized.contains("webinar"),
        normalized.contains("특강"),
    )
    academic_match = or_(
        normalized.contains("academic"),
        normalized.contains("학사"),
        normalized.contains("calendar"),
    )
    other_match = or_(
        normalized.contains("all"),
        normalized.contains("전체"),
        normalized.contains("other"),
        normalized.contains("general"),
        normalized.contains("기타"),
    )
    return case(
        (event_match, "event"),
        (academic_match, "academic"),
        (other_match, "other"),
        else_=None,
    )


def _post_feed_notice_filters(scope: str, notice_category: str | None):
    if notice_category is None:
        return []
    if scope != "notices":
        raise AppException(
            status_code=422,
            message="Request validation failed.",
            code="VALIDATION_ERROR",
        )
    return [_post_feed_notice_category_expression() == notice_category]


def _post_feed_search_filter(q: str | None, current_user: User):
    if q is None:
        return None
    keyword = f"%{q}%"
    author_match = or_(
        User.nickname.ilike(keyword),
        Post.author_nickname_snapshot.ilike(keyword),
    )
    if current_user.role == "admin":
        return or_(
            Post.title.ilike(keyword),
            Post.content.ilike(keyword),
            author_match,
        )
    return or_(
        Post.title.ilike(keyword),
        Post.content.ilike(keyword),
        and_(
            Post.is_anonymous.is_(False),
            Board.slug.not_in(ANONYMOUS_BOARD_SLUGS),
            author_match,
        ),
    )


def _post_feed_block_filter(db: Session, current_user: User):
    blocked_author_ids = db.scalars(
        select(UserBlock.blocked_user_id).where(UserBlock.blocker_id == current_user.id)
    ).all()
    if not blocked_author_ids:
        return None
    return or_(
        Post.is_anonymous.is_(True),
        Board.slug.in_(ANONYMOUS_BOARD_SLUGS),
        Post.author_id.is_(None),
        Post.author_id.not_in(blocked_author_ids),
    )


def _post_attachment_subqueries():
    attachment_counts = (
        select(PostAttachment.post_id, func.count(PostAttachment.id).label("attachment_count"))
        .group_by(PostAttachment.post_id)
        .subquery()
    )
    image_attachment_order = (
        select(
            PostAttachment.post_id.label("post_id"),
            MediaAsset.id.label("thumbnail_media_id"),
            MediaAsset.url.label("thumbnail_url"),
            func.row_number()
            .over(
                partition_by=PostAttachment.post_id,
                order_by=(PostAttachment.sort_order.asc(), PostAttachment.id.asc()),
            )
            .label("rank"),
        )
        .join(MediaAsset, MediaAsset.id == PostAttachment.media_id)
        .where(MediaAsset.content_type.ilike("image/%"), MediaAsset.status == "ready")
        .subquery()
    )
    thumbnails = (
        select(
            image_attachment_order.c.post_id,
            image_attachment_order.c.thumbnail_media_id,
            image_attachment_order.c.thumbnail_url,
        )
        .where(image_attachment_order.c.rank == 1)
        .subquery()
    )
    return attachment_counts, thumbnails


def _serialize_post_list_item(
    *,
    db: Session,
    post: Post,
    board: Board,
    nickname: str | None,
    cohort: str | None,
    attachment_count: int,
    thumbnail_media_id: int | None,
    thumbnail_url: str | None,
    current_user: User,
    q: str | None,
    activity_source_title: str | None = None,
) -> dict:
    content_preview = post_content_preview(_visible_post_content(post, board), board.slug)
    return {
        "id": post.id,
        "board_id": post.board_id,
        "title": post.title,
        "content_preview": content_preview,
        "author_id": _visible_post_author_id(post, board, current_user),
        "author_nickname": _post_author_nickname(post, board, current_user, nickname),
        "author_cohort": _post_author_cohort(post, board, current_user, nickname, cohort),
        "is_anonymous": post.is_anonymous,
        "is_pinned": post.is_pinned,
        "is_notice": post.is_notice,
        "status": post.status,
        "category": post.category,
        "activity_source_title": activity_source_title,
        "metadata": _safe_metadata(post, board),
        "suggestion": _suggestion_payload(db, post.id) if board.board_type == "suggestion" else None,
        "mutual_aid": _mutual_aid_payload(db, post.id) if board.board_type == "mutual_aid" else None,
        "attachment_count": attachment_count,
        "thumbnail_media_id": thumbnail_media_id,
        "thumbnail_url": thumbnail_url,
        "view_count": post.view_count,
        "like_count": post.like_count,
        "comment_count": post.comment_count,
        "deadline_at": post.deadline_at,
        "created_at": post.created_at,
        "highlights": {
            "title": _highlight(post.title, q),
            "content_preview": _highlight(content_preview, q),
        }
        if q
        else None,
    }


def _post_feed_response(
    *,
    db: Session,
    current_user: User,
    filters: list,
    order_by: tuple,
    page: int,
    size: int,
    q: str | None,
):
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
    attachment_counts, thumbnails = _post_attachment_subqueries()
    rows = db.execute(
        select(
            Post,
            Board,
            User.nickname,
            User.cohort,
            func.coalesce(attachment_counts.c.attachment_count, 0),
            thumbnails.c.thumbnail_media_id,
            thumbnails.c.thumbnail_url,
        )
        .join(Board, Board.id == Post.board_id)
        .outerjoin(User, User.id == Post.author_id)
        .outerjoin(attachment_counts, attachment_counts.c.post_id == Post.id)
        .outerjoin(thumbnails, thumbnails.c.post_id == Post.id)
        .where(*filters)
        .order_by(*order_by)
        .offset((page - 1) * size)
        .limit(size)
    ).all()
    data = [
        _serialize_post_list_item(
            db=db,
            post=post,
            board=board,
            nickname=nickname,
            cohort=cohort,
            attachment_count=attachment_count,
            thumbnail_media_id=thumbnail_media_id,
            thumbnail_url=thumbnail_url,
            current_user=current_user,
            q=q,
        )
        for post, board, nickname, cohort, attachment_count, thumbnail_media_id, thumbnail_url in rows
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


@router.get("/posts/feed")
def get_post_feed(
    scope: str = Query(pattern="^(notices|resources|council_activity)$"),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    q: str | None = Query(None, min_length=1),
    notice_category: str | None = Query(None, pattern="^(academic|event|other)$"),
    sort: str = Query("latest", pattern="^(latest|popular|views)$"),
    pin_priority: bool = Query(True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    filters = [
        Board.is_active.is_(True),
        Post.deleted_at.is_(None),
        post_status_read_filter(current_user),
        _post_feed_scope_filter(scope),
    ]
    if current_user.role != "admin":
        filters.append(Board.read_permission.in_(["guest", "user"]))
    filters.extend(_post_feed_notice_filters(scope, notice_category))
    search_filter = _post_feed_search_filter(q, current_user)
    if search_filter is not None:
        filters.append(search_filter)
    block_filter = _post_feed_block_filter(db, current_user)
    if block_filter is not None:
        filters.append(block_filter)
    return _post_feed_response(
        db=db,
        current_user=current_user,
        filters=filters,
        order_by=_post_list_order(sort, pin_priority=pin_priority),
        page=page,
        size=size,
        q=q,
    )


@router.get("/boards/{board_id}/posts")
def get_posts(
    board_id: int,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    q: str | None = Query(None, min_length=1),
    category: str | None = None,
    status: str | None = None,
    sort: str = Query("latest", pattern="^(latest|popular|views)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    board = db.get(Board, board_id)
    if board is None or not board.is_active:
        raise AppException(status_code=404, message="Board not found.", code="NOT_FOUND")
    if not can_read_board(current_user, board.read_permission):
        raise AppException(status_code=403, message="Forbidden.", code="FORBIDDEN")

    filters = [Post.board_id == board_id, Post.deleted_at.is_(None)]
    filters.append(post_status_read_filter(current_user))
    if q:
        keyword = f"%{q}%"
        if board.board_type == "activity_certification":
            filters.append(_activity_certification_search_filter(board, keyword))
        elif hides_author_identity(board) and current_user.role != "admin":
            filters.append(Post.title.ilike(keyword) | Post.content.ilike(keyword))
        else:
            author_match = or_(
                User.nickname.ilike(keyword),
                Post.author_nickname_snapshot.ilike(keyword),
            )
            if current_user.role != "admin":
                author_match = and_(Post.is_anonymous.is_(False), author_match)
            filters.append(Post.title.ilike(keyword) | Post.content.ilike(keyword) | author_match)
    if category:
        filters.append(Post.category == category)
    if status:
        filters.append(Post.status == status)
    blocked_author_ids = db.scalars(
        select(UserBlock.blocked_user_id).where(UserBlock.blocker_id == current_user.id)
    ).all()
    if blocked_author_ids and not hides_author_identity(board):
        filters.append(
            or_(
                Post.is_anonymous.is_(True),
                Post.author_id.is_(None),
                Post.author_id.not_in(blocked_author_ids),
            )
        )

    total = (
        db.scalar(
            select(func.count(Post.id))
            .select_from(Post)
            .outerjoin(User, User.id == Post.author_id)
            .where(*filters)
        )
        or 0
    )
    total_pages = math.ceil(total / size) if total > 0 else 0

    order_by = _post_list_order(sort)
    attachment_counts, thumbnails = _post_attachment_subqueries()

    rows = db.execute(
        select(
            Post,
            User.nickname,
            User.cohort,
            func.coalesce(attachment_counts.c.attachment_count, 0),
            thumbnails.c.thumbnail_media_id,
            thumbnails.c.thumbnail_url,
        )
        .outerjoin(User, User.id == Post.author_id)
        .outerjoin(attachment_counts, attachment_counts.c.post_id == Post.id)
        .outerjoin(thumbnails, thumbnails.c.post_id == Post.id)
        .where(*filters)
        .order_by(*order_by)
        .offset((page - 1) * size)
        .limit(size)
    ).all()
    activity_source_titles = _club_activity_source_titles(db, board, [row[0] for row in rows])

    data = [
        _serialize_post_list_item(
            db=db,
            post=post,
            board=board,
            nickname=nickname,
            cohort=cohort,
            attachment_count=attachment_count,
            thumbnail_media_id=thumbnail_media_id,
            thumbnail_url=thumbnail_url,
            current_user=current_user,
            q=q,
            activity_source_title=activity_source_titles.get(_activity_source_post_id(post.metadata_json)),
        )
        for post, nickname, cohort, attachment_count, thumbnail_media_id, thumbnail_url in rows
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


def _highlight(text: str, keyword: str | None) -> str:
    if not keyword:
        return text
    lower_text = text.lower()
    lower_keyword = keyword.lower()
    start = lower_text.find(lower_keyword)
    if start < 0:
        return text
    end = start + len(keyword)
    return f"{text[:start]}<mark>{text[start:end]}</mark>{text[end:]}"


def _post_attachments(
    db: Session,
    post_id: int,
    board: Board,
    current_user: User,
    *,
    include_evidence: bool = False,
) -> list[dict]:
    rows = db.execute(
        select(PostAttachment, MediaAsset)
        .join(MediaAsset, MediaAsset.id == PostAttachment.media_id)
        .where(PostAttachment.post_id == post_id)
        .order_by(PostAttachment.sort_order.asc(), PostAttachment.id.asc())
    ).all()
    return [
        {
            "id": media.id,
            "original_filename": media.original_filename,
            "content_type": media.content_type,
            "file_size": media.file_size,
            "url": media.url,
            "is_private": media.is_private,
        }
        for _, media in rows
        if include_evidence
        or not media.is_private
        or board.board_type == "mutual_aid"
        or media.owner_id == current_user.id
        or current_user.role == "admin"
    ]


def _replace_attachments(
    db: Session,
    post_id: int,
    attachment_ids: list[int],
    current_user: User,
    evidence_link: str | None = None,
    *,
    preserve_existing_when_empty: bool = False,
) -> None:
    post = db.get(Post, post_id)
    board = db.get(Board, post.board_id) if post is not None else None
    requires_private = board is not None and board.board_type == "mutual_aid"
    requires_album_images = board is not None and board.board_type == "album"
    requires_activity_images = board is not None and board.board_type == "activity_certification"
    requires_admin_participation_image = board is not None and board.slug in ADMIN_PARTICIPATION_BOARD_SLUGS
    existing_attachment_ids = set(
        db.scalars(select(PostAttachment.media_id).where(PostAttachment.post_id == post_id))
    )
    if (
        requires_private
        and preserve_existing_when_empty
        and not attachment_ids
        and existing_attachment_ids
    ):
        # Legacy clients edit redacted detail data. An empty list without the
        # explicit replacement flag still means "keep protected evidence".
        return
    if requires_private and not attachment_ids and not (evidence_link or "").strip():
        raise AppException(
            status_code=400,
            message="Mutual-aid requests require private evidence.",
            code="EVIDENCE_REQUIRED",
        )
    if (requires_album_images or requires_activity_images) and not attachment_ids:
        message = "Album posts require at least one image." if requires_album_images else "Activity certifications require at least one image."
        raise AppException(status_code=400, message=message, code="IMAGE_REQUIRED")
    if requires_album_images and len(attachment_ids) > PHOTO_ALBUM_ATTACHMENT_LIMIT:
        raise AppException(
            status_code=400,
            message="Album posts accept at most 20 images.",
            code="ALBUM_IMAGE_LIMIT_EXCEEDED",
        )
    media_assets: list[MediaAsset] = []
    for media_id in attachment_ids:
        media = db.get(MediaAsset, media_id)
        retained_evidence = requires_private and media_id in existing_attachment_ids
        if media is None or media.status != "ready" or (
            media.owner_id != current_user.id and current_user.role != "admin" and not retained_evidence
        ):
            raise AppException(status_code=400, message="Invalid attachment.", code="BAD_REQUEST")
        if requires_private and not media.is_private and not retained_evidence:
            raise AppException(status_code=400, message="Mutual-aid evidence must use private upload.", code="PRIVATE_MEDIA_REQUIRED")
        if not requires_private and media.is_private:
            raise AppException(status_code=400, message="Private media cannot be attached to this board.", code="BAD_REQUEST")
        if (requires_album_images or requires_activity_images) and not media.content_type.lower().startswith("image/"):
            raise AppException(status_code=400, message="This board only accepts images.", code="IMAGE_ONLY")
        media_assets.append(media)
    if requires_admin_participation_image and not any(media.content_type.lower().startswith("image/") for media in media_assets):
        raise AppException(status_code=400, message="Participation guide posts require at least one image.", code="IMAGE_REQUIRED")

    db.query(PostAttachment).filter(PostAttachment.post_id == post_id).delete()
    for index, media in enumerate(media_assets):
        media_id = media.id
        db.add(PostAttachment(post_id=post_id, media_id=media_id, sort_order=index))


def _reject_closed_study_recruit(board: Board, category: str | None, metadata: dict | None) -> None:
    """스터디 모집글은 마감 상태로 처음부터 등록할 수 없다. 마감은 등록 후 수정으로만 전환한다."""

    if board.slug != "study-recruit":
        return
    is_closed = (category or "").strip() == "마감" or str((metadata or {}).get("recruitment_status") or "").strip() == "closed"
    if is_closed:
        raise AppException(
            status_code=400,
            message="A study recruitment post cannot be created as closed.",
            code="BAD_REQUEST",
        )


def _validate_admin_participation_post(board: Board, metadata: dict | None, current_user: User) -> None:
    if board.slug not in ADMIN_PARTICIPATION_BOARD_SLUGS:
        return
    if current_user.role != "admin":
        raise AppException(status_code=403, message="Only admins can manage participation guide posts.", code="FORBIDDEN")

    if board.slug == "club-promo" and "club_operation_status" in (metadata or {}):
        if metadata["club_operation_status"] not in ("active", "ended"):
            raise AppException(
                status_code=422,
                message="Club operation status must be active or ended.",
                code="INVALID_CLUB_OPERATION_STATUS",
            )

    application_url = str((metadata or {}).get("application_url") or "").strip()
    parsed = urlparse(application_url)
    if not application_url:
        raise AppException(status_code=422, message="Participation guide posts require an application URL.", code="APPLICATION_URL_REQUIRED")
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise AppException(status_code=422, message="Application URL must use http or https.", code="INVALID_APPLICATION_URL")


def _ensure_admin_participation_image(db: Session, post: Post, board: Board) -> None:
    if board.slug not in ADMIN_PARTICIPATION_BOARD_SLUGS:
        return
    image_count = db.scalar(
        select(func.count(PostAttachment.id))
        .join(MediaAsset, MediaAsset.id == PostAttachment.media_id)
        .where(
            PostAttachment.post_id == post.id,
            MediaAsset.status == "ready",
            MediaAsset.content_type.ilike("image/%"),
        )
    ) or 0
    if image_count < 1:
        raise AppException(status_code=400, message="Participation guide posts require at least one image.", code="IMAGE_REQUIRED")


def _suggestion_payload(db: Session, post_id: int) -> dict | None:
    suggestion = db.scalar(select(PostSuggestion).where(PostSuggestion.post_id == post_id))
    if suggestion is None:
        return None
    return {
        "category": suggestion.suggestion_category,
        "status": suggestion.status,
        "admin_reply": suggestion.admin_reply,
        "replied_by": suggestion.replied_by,
        "replied_at": suggestion.replied_at,
    }


def _mutual_aid_payload(db: Session, post_id: int) -> dict | None:
    mutual_aid = db.scalar(select(PostMutualAid).where(PostMutualAid.post_id == post_id))
    if mutual_aid is None:
        return None
    post = db.get(Post, post_id)
    attachment_count = int(
        db.scalar(
            select(func.count(PostAttachment.id)).where(PostAttachment.post_id == post_id)
        )
        or 0
    )
    return {
        "event_type": mutual_aid.event_type,
        "event_date": mutual_aid.event_date.isoformat(),
        "relation": mutual_aid.relation,
        "status": mutual_aid.status,
        "rejection_reason": mutual_aid.rejection_reason,
        "reviewed_by": mutual_aid.reviewed_by,
        "reviewed_at": mutual_aid.reviewed_at,
        "has_evidence": attachment_count > 0 or bool(_evidence_link(post.metadata_json if post else None)),
    }


def _parse_event_date(value: object) -> date:
    if not isinstance(value, str) or not value.strip():
        raise AppException(status_code=422, message="Mutual-aid event date is required.", code="VALIDATION_ERROR")
    try:
        return date.fromisoformat(value.strip().replace(".", "-"))
    except ValueError as exc:
        raise AppException(
            status_code=422,
            message="Mutual-aid event date must use YYYY-MM-DD.",
            code="VALIDATION_ERROR",
        ) from exc


def _minimum_mutual_aid_event_date(now: datetime | None = None) -> date:
    current = now or datetime.now(timezone.utc)
    if current.tzinfo is None:
        current = current.replace(tzinfo=timezone.utc)
    return current.astimezone(SEOUL_TIME_ZONE).date() + timedelta(days=MUTUAL_AID_MIN_LEAD_DAYS)


def _validate_mutual_aid_event_date(event_date: date) -> None:
    if event_date >= _minimum_mutual_aid_event_date():
        return
    raise AppException(
        status_code=422,
        message="Mutual-aid event date cannot be before today.",
        code="MUTUAL_AID_DATE_TOO_SOON",
    )


def _evidence_link(metadata: dict | None) -> str | None:
    """증빙 링크(청첩장/부고장 URL). 파일 첨부 대신 사용할 수 있다."""

    value = (metadata or {}).get("proof_url")
    return value.strip() if isinstance(value, str) and value.strip() else None


def _is_valid_evidence_link_host(hostname: str) -> bool:
    """호스트가 도메인 꼴인지 확인한다.

    `http://www.`처럼 도메인을 덜 입력해도 netloc이 비어 있지 않아 통과하던
    것을 막는다. 퓨니코드(xn--)와 한글 도메인을 거르지 않도록 글자 종류는
    제한하지 않고, 라벨 구조만 본다. 클라이언트도 같은 기준을 쓴다.
    """

    labels = hostname.split(".")
    if len(labels) < 2 or any(not label for label in labels):
        return False
    return len(labels[-1]) >= 2


def _validate_evidence_link(metadata: dict | None) -> None:
    link = _evidence_link(metadata)
    if link is None:
        return
    parsed = urlparse(link)
    if (
        parsed.scheme not in {"http", "https"}
        or not parsed.hostname
        or not _is_valid_evidence_link_host(parsed.hostname)
        or len(link) > 500
    ):
        raise AppException(
            status_code=422,
            message="Evidence link must be an http(s) URL.",
            code="VALIDATION_ERROR",
        )


def _upsert_mutual_aid_extension(db: Session, post: Post, board: Board, category: str | None, metadata: dict | None) -> None:
    if board.board_type != "mutual_aid":
        return
    event_type = (category or "").strip()
    relation = str((metadata or {}).get("relation") or "").strip()
    if not event_type or not relation:
        raise AppException(
            status_code=422,
            message="Mutual-aid event type and relation are required.",
            code="VALIDATION_ERROR",
        )
    _validate_evidence_link(metadata)
    event_date = _parse_event_date((metadata or {}).get("event_date"))
    mutual_aid = db.scalar(select(PostMutualAid).where(PostMutualAid.post_id == post.id))
    if mutual_aid is None:
        _validate_mutual_aid_event_date(event_date)
        mutual_aid = PostMutualAid(
            post_id=post.id,
            event_type=event_type,
            event_date=event_date,
            relation=relation,
            status="processing",
        )
        db.add(mutual_aid)
        return
    if mutual_aid.status != "processing":
        raise AppException(
            status_code=400,
            message="Completed or rejected mutual-aid requests cannot be edited.",
            code="BAD_REQUEST",
        )
    if event_date != mutual_aid.event_date:
        _validate_mutual_aid_event_date(event_date)
    mutual_aid.event_type = event_type
    mutual_aid.event_date = event_date
    mutual_aid.relation = relation


def _upsert_suggestion_extension(db: Session, post: Post, board: Board, category: str | None) -> None:
    if board.board_type != "suggestion":
        return
    suggestion = db.scalar(select(PostSuggestion).where(PostSuggestion.post_id == post.id))
    if suggestion is None:
        suggestion = PostSuggestion(
            post_id=post.id,
            suggestion_category=category,
            status="received",
        )
        db.add(suggestion)
    else:
        suggestion.suggestion_category = category


def _suggestion_has_admin_reply(db: Session, post_id: int) -> bool:
    suggestion = db.scalar(select(PostSuggestion).where(PostSuggestion.post_id == post_id))
    return bool(suggestion and suggestion.admin_reply)


def _require_post_edit(db: Session, post: Post, board: Board, current_user: User) -> None:
    if post.author_id != current_user.id and current_user.role != "admin":
        raise AppException(status_code=403, message="Forbidden.", code="FORBIDDEN")
    if board.board_type == "mutual_aid":
        mutual_aid = db.scalar(select(PostMutualAid).where(PostMutualAid.post_id == post.id))
        if mutual_aid is None or mutual_aid.status != "processing":
            raise AppException(
                status_code=400,
                message="Only processing mutual-aid requests can be edited.",
                code="BAD_REQUEST",
            )


@router.get("/posts/admin/all")
def get_admin_posts(
    page: int = Query(1, ge=1),
    size: int = Query(30, ge=1, le=100),
    q: str | None = Query(None, min_length=1),
    board_id: int | None = None,
    board_category: str | None = None,
    board_type: str | None = None,
    status: str | None = Query(None, pattern="^(draft|published|hidden|deleted)$"),
    is_pinned: bool | None = None,
    is_notice: bool | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    filters = [Post.deleted_at.is_(None)]
    if board_id:
        filters.append(Post.board_id == board_id)
    if board_category:
        filters.append(Board.category == board_category)
    if board_type:
        filters.append(Board.board_type == board_type)
    if status:
        filters.append(Post.status == status)
    if is_pinned is not None:
        filters.append(Post.is_pinned.is_(is_pinned))
    if is_notice is not None:
        filters.append(Post.is_notice.is_(is_notice))
    if q:
        keyword = f"%{q}%"
        filters.append(
            Post.title.ilike(keyword)
            | Post.content.ilike(keyword)
            | User.nickname.ilike(keyword)
            | Post.author_nickname_snapshot.ilike(keyword)
            | Board.name.ilike(keyword)
        )

    total = (
        db.scalar(
            select(func.count(Post.id))
            .select_from(Post)
            .outerjoin(User, User.id == Post.author_id)
            .join(Board, Board.id == Post.board_id)
            .where(*filters)
        )
        or 0
    )
    total_pages = math.ceil(total / size) if total > 0 else 0

    attachment_counts = (
        select(PostAttachment.post_id, func.count(PostAttachment.id).label("attachment_count"))
        .group_by(PostAttachment.post_id)
        .subquery()
    )
    image_attachment_order = (
        select(
            PostAttachment.post_id.label("post_id"),
            MediaAsset.id.label("thumbnail_media_id"),
            MediaAsset.url.label("thumbnail_url"),
            func.row_number()
            .over(
                partition_by=PostAttachment.post_id,
                order_by=(PostAttachment.sort_order.asc(), PostAttachment.id.asc()),
            )
            .label("rank"),
        )
        .join(MediaAsset, MediaAsset.id == PostAttachment.media_id)
        .where(MediaAsset.content_type.ilike("image/%"), MediaAsset.status == "ready")
        .subquery()
    )
    thumbnails = (
        select(
            image_attachment_order.c.post_id,
            image_attachment_order.c.thumbnail_media_id,
            image_attachment_order.c.thumbnail_url,
        )
        .where(image_attachment_order.c.rank == 1)
        .subquery()
    )

    rows = db.execute(
        select(
            Post,
            User.nickname,
            User.cohort,
            Board.name.label("board_name"),
            Board.category.label("board_category"),
            Board.board_type.label("board_type"),
            func.coalesce(attachment_counts.c.attachment_count, 0),
            thumbnails.c.thumbnail_media_id,
            thumbnails.c.thumbnail_url,
        )
        .outerjoin(User, User.id == Post.author_id)
        .join(Board, Board.id == Post.board_id)
        .outerjoin(attachment_counts, attachment_counts.c.post_id == Post.id)
        .outerjoin(thumbnails, thumbnails.c.post_id == Post.id)
        .where(*filters)
        .order_by(Post.created_at.desc(), Post.id.desc())
        .offset((page - 1) * size)
        .limit(size)
    ).all()

    data = [
        {
            "id": post.id,
            "board_id": post.board_id,
            "board_name": board_name,
            "board_category": board_category,
            "board_type": board_type,
            "title": post.title,
            "content_preview": post.content[:100],
            "author_id": post.author_id,
            "author_nickname": resolve_author_display(
                live_nickname=nickname,
                live_cohort=cohort,
                snapshot_nickname=post.author_nickname_snapshot,
                snapshot_cohort=post.author_cohort_snapshot,
            ).nickname,
            "author_cohort": resolve_author_display(
                live_nickname=nickname,
                live_cohort=cohort,
                snapshot_nickname=post.author_nickname_snapshot,
                snapshot_cohort=post.author_cohort_snapshot,
            ).cohort,
            "is_anonymous": post.is_anonymous,
            "is_pinned": post.is_pinned,
            "is_notice": post.is_notice,
            "status": post.status,
            "category": post.category,
            "metadata": post.metadata_json,
            "suggestion": _suggestion_payload(db, post.id) if board_type == "suggestion" else None,
            "mutual_aid": _mutual_aid_payload(db, post.id) if board_type == "mutual_aid" else None,
            "attachment_count": attachment_count,
            "thumbnail_media_id": thumbnail_media_id,
            "thumbnail_url": thumbnail_url,
            "view_count": post.view_count,
            "like_count": post.like_count,
            "comment_count": post.comment_count,
            "deadline_at": post.deadline_at,
            "created_at": post.created_at,
            "updated_at": post.updated_at,
            "highlights": {
                "title": _highlight(post.title, q),
                "content_preview": _highlight(post.content[:100], q),
            }
            if q
            else None,
        }
        for post, nickname, cohort, board_name, board_category, board_type, attachment_count, thumbnail_media_id, thumbnail_url in rows
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


@router.get("/posts/{post_id}")
def get_post_detail(
    post_id: int,
    for_edit: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = db.execute(
        select(Post, User.nickname, User.cohort)
        .outerjoin(User, User.id == Post.author_id)
        .where(Post.id == post_id, Post.deleted_at.is_(None))
    ).first()
    if row is None:
        raise AppException(status_code=404, message="Post not found.", code="NOT_FOUND")

    post, nickname, cohort = row
    board = require_post_read(db, post, current_user)
    if for_edit:
        _require_post_edit(db, post, board, current_user)
    include_evidence = for_edit and board.board_type == "mutual_aid"

    db.execute(
        update(Post)
        .where(Post.id == post.id)
        .values(view_count=Post.view_count + 1, updated_at=post.updated_at)
    )

    user_id = current_user.id
    is_liked = db.scalar(
        select(Like.id).where(Like.post_id == post_id, Like.user_id == user_id).limit(1)
    ) is not None
    is_bookmarked = db.scalar(
        select(Bookmark.id).where(Bookmark.post_id == post_id, Bookmark.user_id == user_id).limit(1)
    ) is not None

    db.commit()
    db.refresh(post)
    activity_source_titles = _club_activity_source_titles(db, board, [post])

    return success_response(
        {
            "id": post.id,
            "board_id": post.board_id,
            "title": post.title,
            "content": _visible_post_content(post, board),
            "author_id": _visible_post_author_id(post, board, current_user),
            "author_nickname": _post_author_nickname(post, board, current_user, nickname),
            "author_cohort": _post_author_cohort(post, board, current_user, nickname, cohort),
            "is_anonymous": post.is_anonymous,
            "is_pinned": post.is_pinned,
            "is_notice": post.is_notice,
            "status": post.status,
            "category": post.category,
            "activity_source_title": activity_source_titles.get(_activity_source_post_id(post.metadata_json)),
            "activity_participants": _activity_participant_details(db, board, post),
            "metadata": _safe_metadata(
                post,
                board,
                include_sensitive=current_user.role == "admin" or include_evidence,
                include_bank_account=for_edit and board.board_type == "activity_certification",
            ),
            "suggestion": _suggestion_payload(db, post.id),
            "mutual_aid": _mutual_aid_payload(db, post.id),
            "attachments": _post_attachments(db, post.id, board, current_user, include_evidence=include_evidence),
            "view_count": post.view_count,
            "like_count": post.like_count,
            "comment_count": post.comment_count,
            "deadline_at": post.deadline_at,
            "is_liked": is_liked,
            "is_bookmarked": is_bookmarked,
            "created_at": post.created_at,
            "updated_at": post.updated_at,
        }
    )


@router.post("/boards/{board_id}/posts")
def create_post(
    board_id: int,
    payload: PostCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    enforce_rate_limit(request, action="post.create", subject=str(current_user.id), limit=20, ip_limit=60, window_seconds=300)
    board = db.get(Board, board_id)
    if board is None or not board.is_active:
        raise AppException(status_code=404, message="Board not found.", code="NOT_FOUND")
    _enforce_council_management_policy(board, current_user)
    if not can_write_board(current_user, board.write_permission):
        raise AppException(status_code=403, message="Forbidden.", code="FORBIDDEN")
    normalized_content, normalized_metadata = normalize_participation_guide(
        board.slug,
        payload.content,
        payload.metadata,
    )
    _validate_post_content(board, normalized_content)
    _validate_admin_participation_post(board, normalized_metadata, current_user)
    _reject_closed_study_recruit(board, payload.category, normalized_metadata)
    if payload.is_anonymous and not board.allow_anonymous and board.board_type != "suggestion":
        raise AppException(status_code=400, message="Anonymous posts are not allowed on this board.", code="BAD_REQUEST")

    is_anonymous = True if board.board_type == "suggestion" else payload.is_anonymous
    post_metadata = _canonical_activity_metadata(db, board, normalized_metadata)
    post_metadata, activity_source_title = _canonical_club_activity_source(db, board, post_metadata)
    post = Post(
        board_id=board_id,
        author_id=current_user.id,
        author_nickname_snapshot=current_user.nickname,
        author_cohort_snapshot=current_user.cohort,
        title=payload.title,
        content="" if board.board_type == "album" else normalized_content,
        is_anonymous=is_anonymous,
        is_notice=board.board_type == "notice",
        category=activity_source_title or canonical_post_category(board, payload.category),
        metadata_json=post_metadata,
        deadline_at=payload.deadline_at if board.board_type == "notice" else None,
    )
    db.add(post)
    db.flush()
    _upsert_suggestion_extension(db, post, board, payload.category)
    _upsert_mutual_aid_extension(db, post, board, payload.category, normalized_metadata)
    _replace_attachments(db, post.id, payload.attachment_ids or [], current_user, _evidence_link(normalized_metadata))
    if post.is_notice:
        active_user_ids = db.scalars(select(User.id).where(User.is_active.is_(True))).all()
        for user_id in active_user_ids:
            create_notification(
                db,
                user_id=user_id,
                actor_id=current_user.id,
                notification_type="notice",
                message=notice_message(post.title),
                post_id=post.id,
                setting_field="notify_notice",
                dedupe_key=f"notice:{post.id}:{user_id}",
            )
        if current_user.role == "admin":
            log_admin_action(db, actor_id=current_user.id, action="notice.create", target_type="post", target_id=post.id)
    db.commit()
    db.refresh(post)

    return success_response({"id": post.id})


@router.put("/posts/{post_id}")
def update_post(
    post_id: int,
    payload: PostUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    post = db.get(Post, post_id)
    if post is None or post.deleted_at is not None:
        raise AppException(status_code=404, message="Post not found.", code="NOT_FOUND")
    board = require_post_read(db, post, current_user)
    normalized_content, normalized_metadata = normalize_participation_guide(
        board.slug,
        payload.content,
        payload.metadata,
    )
    if board is not None:
        _enforce_council_management_policy(board, current_user)
        _validate_admin_participation_post(board, normalized_metadata, current_user)
    _require_post_edit(db, post, board, current_user)
    if payload.replace_evidence and board.board_type == "mutual_aid":
        if payload.attachment_ids is None or not isinstance((normalized_metadata or {}).get("proof_url"), str):
            raise AppException(
                status_code=422,
                message="Evidence replacement requires attachment_ids and metadata.proof_url (empty to clear).",
                code="VALIDATION_ERROR",
            )
    target_board = board
    if payload.board_id is not None and payload.board_id != post.board_id:
        if board.category != "resources" or board.board_type != "resource":
            raise AppException(
                status_code=400,
                message="Posts can only be moved between resource boards.",
                code="BAD_REQUEST",
            )
        target_board = db.get(Board, payload.board_id)
        if target_board is None or not target_board.is_active:
            raise AppException(status_code=404, message="Board not found.", code="NOT_FOUND")
        if target_board.category != "resources" or target_board.board_type != "resource":
            raise AppException(
                status_code=400,
                message="Posts can only be moved between resource boards.",
                code="BAD_REQUEST",
            )
        if not can_read_board(current_user, target_board.read_permission) or not can_write_board(
            current_user,
            target_board.write_permission,
        ):
            raise AppException(status_code=403, message="Forbidden.", code="FORBIDDEN")

    if target_board is not None:
        _validate_post_content(target_board, normalized_content)
    if board is not None and board.board_type == "suggestion" and current_user.role != "admin":
        if _suggestion_has_admin_reply(db, post.id):
            raise AppException(status_code=403, message="Answered suggestions cannot be edited.", code="FORBIDDEN")
    if payload.is_anonymous and (
        target_board is None or (not target_board.allow_anonymous and target_board.board_type != "suggestion")
    ):
        raise AppException(status_code=400, message="Anonymous posts are not allowed on this board.", code="BAD_REQUEST")

    is_anonymous = (
        True if target_board is not None and target_board.board_type == "suggestion" else payload.is_anonymous
    )
    if target_board is not None:
        post.board_id = target_board.id
    post.title = payload.title
    post.content = "" if target_board is not None and target_board.board_type == "album" else normalized_content
    post.is_anonymous = is_anonymous
    existing_metadata = dict(post.metadata_json or {})
    merged_metadata = _metadata_for_update(
        post,
        target_board,
        normalized_metadata,
        has_new_attachments=bool(payload.attachment_ids),
    )
    canonical_metadata = _canonical_activity_metadata(
        db,
        target_board,
        merged_metadata,
        existing_metadata=existing_metadata,
    )
    canonical_metadata, activity_source_title = _canonical_club_activity_source(
        db,
        target_board,
        canonical_metadata,
        existing_metadata=existing_metadata,
    )
    post.category = activity_source_title or canonical_post_category(target_board, payload.category)
    post.metadata_json = canonical_metadata
    post.deadline_at = payload.deadline_at if target_board is not None and target_board.board_type == "notice" else None
    if target_board is not None:
        _upsert_suggestion_extension(db, post, target_board, payload.category)
        _upsert_mutual_aid_extension(db, post, target_board, payload.category, normalized_metadata)
    if payload.attachment_ids is not None:
        incoming_evidence_link = _evidence_link(normalized_metadata)
        _replace_attachments(
            db,
            post.id,
            payload.attachment_ids,
            current_user,
            _evidence_link(post.metadata_json),
            preserve_existing_when_empty=(
                target_board is not None
                and target_board.board_type == "mutual_aid"
                and current_user.role != "admin"
                and not payload.replace_evidence
                and not payload.attachment_ids
                and incoming_evidence_link is None
            ),
        )
        db.flush()
    if target_board is not None:
        _ensure_admin_participation_image(db, post, target_board)
    db.commit()
    db.refresh(post)

    return success_response({"id": post.id})


@router.put("/posts/{post_id}/representative-image")
def update_post_representative_image(
    post_id: int,
    payload: PostRepresentativeImageUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    post = db.get(Post, post_id)
    if post is None or post.deleted_at is not None:
        raise AppException(status_code=404, message="Post not found.", code="NOT_FOUND")
    board = db.get(Board, post.board_id)
    if board is None or board.slug not in ADMIN_PARTICIPATION_BOARD_SLUGS:
        raise AppException(
            status_code=400,
            message="Representative images can only be changed for participation guides.",
            code="BAD_REQUEST",
        )

    replacement = db.get(MediaAsset, payload.media_id)
    if replacement is None or replacement.status != "ready":
        raise AppException(status_code=400, message="Invalid attachment.", code="BAD_REQUEST")
    if replacement.is_private:
        raise AppException(status_code=400, message="Private media cannot be attached to this board.", code="BAD_REQUEST")
    if not replacement.content_type.lower().startswith("image/"):
        raise AppException(status_code=400, message="Representative media must be an image.", code="IMAGE_ONLY")

    rows = db.execute(
        select(PostAttachment, MediaAsset)
        .join(MediaAsset, MediaAsset.id == PostAttachment.media_id)
        .where(PostAttachment.post_id == post.id)
        .order_by(PostAttachment.sort_order.asc(), PostAttachment.id.asc())
    ).all()
    existing_replacement = next((link for link, media in rows if media.id == replacement.id), None)
    hero_link = next((link for link, media in rows if media.content_type.lower().startswith("image/")), None)

    if existing_replacement is not None and existing_replacement is not hero_link:
        raise AppException(status_code=400, message="Media is already attached to this post.", code="BAD_REQUEST")
    if hero_link is None:
        next_order = max((link.sort_order for link, _ in rows), default=-1) + 1
        db.add(PostAttachment(post_id=post.id, media_id=replacement.id, sort_order=next_order))
    else:
        hero_link.media_id = replacement.id

    post.updated_at = utc_now()
    log_admin_action(
        db,
        actor_id=current_user.id,
        action="post.representative_image.update",
        target_type="post",
        target_id=post.id,
    )
    db.commit()

    return success_response({"post_id": post.id, "media_id": replacement.id})


@router.delete("/posts/{post_id}")
def delete_post(post_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    post = db.get(Post, post_id)
    if post is None or post.deleted_at is not None:
        raise AppException(status_code=404, message="Post not found.", code="NOT_FOUND")
    board = require_post_read(db, post, current_user)
    if post.author_id != current_user.id and current_user.role != "admin":
        raise AppException(status_code=403, message="Forbidden.", code="FORBIDDEN")
    if board is not None:
        _enforce_council_management_policy(board, current_user)
    if board is not None and board.board_type == "suggestion" and current_user.role != "admin":
        if _suggestion_has_admin_reply(db, post.id):
            raise AppException(status_code=403, message="Answered suggestions cannot be deleted.", code="FORBIDDEN")
    if board is not None and board.board_type == "mutual_aid" and current_user.role != "admin":
        mutual_aid = db.scalar(select(PostMutualAid).where(PostMutualAid.post_id == post.id))
        if mutual_aid is not None and mutual_aid.status == "completed":
            raise AppException(
                status_code=403,
                message="Completed mutual-aid requests cannot be deleted.",
                code="FORBIDDEN",
            )

    from app.security import utc_now

    post.deleted_at = utc_now()
    if current_user.role == "admin":
        log_admin_action(db, actor_id=current_user.id, action="post.delete", target_type="post", target_id=post.id)
    db.commit()

    return success_response({"id": post_id})


@router.put("/posts/{post_id}/pin")
def set_post_pin(
    post_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    post = db.get(Post, post_id)
    if post is None or post.deleted_at is not None:
        raise AppException(status_code=404, message="Post not found.", code="NOT_FOUND")

    post.is_pinned = bool(payload.get("is_pinned", False))
    log_admin_action(
        db,
        actor_id=admin.id,
        action="post.pin.update",
        target_type="post",
        target_id=post.id,
        details={"is_pinned": post.is_pinned},
    )
    db.commit()
    db.refresh(post)

    return success_response({"post_id": post.id, "is_pinned": post.is_pinned})


@router.post("/posts/{post_id}/like")
def toggle_like(post_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    user_id = current_user.id
    post = db.get(Post, post_id)
    if post is None or post.deleted_at is not None:
        raise AppException(status_code=404, message="Post not found.", code="NOT_FOUND")
    require_post_read(db, post, current_user)

    like = db.scalar(select(Like).where(Like.post_id == post_id, Like.user_id == user_id))
    if like is None:
        db.add(Like(post_id=post_id, user_id=user_id))
        post.like_count += 1
        is_liked = True
        create_notification(
            db,
            user_id=post.author_id,
            actor_id=current_user.id,
            notification_type="like",
            message=like_message(post.title),
            post_id=post.id,
            setting_field="notify_like",
        )
    else:
        db.delete(like)
        post.like_count = max(0, post.like_count - 1)
        is_liked = False

    db.commit()
    db.refresh(post)

    return success_response({"post_id": post_id, "is_liked": is_liked, "like_count": post.like_count})


@router.post("/posts/{post_id}/bookmark")
def toggle_bookmark(post_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    user_id = current_user.id
    post = db.get(Post, post_id)
    if post is None or post.deleted_at is not None:
        raise AppException(status_code=404, message="Post not found.", code="NOT_FOUND")
    require_post_read(db, post, current_user)

    bookmark = db.scalar(select(Bookmark).where(Bookmark.post_id == post_id, Bookmark.user_id == user_id))
    if bookmark is None:
        db.add(Bookmark(post_id=post_id, user_id=user_id))
        is_bookmarked = True
    else:
        db.delete(bookmark)
        is_bookmarked = False

    db.commit()

    return success_response({"post_id": post_id, "is_bookmarked": is_bookmarked})


@router.put("/posts/{post_id}/suggestion")
def update_suggestion(
    post_id: int,
    payload: SuggestionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    post = db.get(Post, post_id)
    if post is None or post.deleted_at is not None:
        raise AppException(status_code=404, message="Post not found.", code="NOT_FOUND")

    board = db.get(Board, post.board_id)
    if board is None or board.board_type != "suggestion":
        raise AppException(status_code=400, message="This post is not a suggestion.", code="BAD_REQUEST")

    suggestion = db.scalar(select(PostSuggestion).where(PostSuggestion.post_id == post_id))
    if suggestion is None:
        suggestion = PostSuggestion(post_id=post_id, suggestion_category=post.category)
        db.add(suggestion)

    previous_reply = suggestion.admin_reply
    next_reply = payload.admin_reply.strip() if payload.admin_reply else None
    if payload.status == "answered" and not next_reply:
        raise AppException(
            status_code=422,
            message="An official reply is required to complete a suggestion.",
            code="ADMIN_REPLY_REQUIRED",
        )
    suggestion.admin_reply = next_reply
    suggestion.status = "answered" if next_reply else payload.status
    if next_reply:
        suggestion.replied_by = current_user.id
        suggestion.replied_at = utc_now()

    if next_reply and next_reply != previous_reply:
        create_notification(
            db,
            user_id=post.author_id,
            actor_id=current_user.id,
            notification_type="admin_reply",
            message=ADMIN_REPLY_MESSAGE,
            post_id=post.id,
            setting_field="notify_council",
        )

    log_admin_action(
        db,
        actor_id=current_user.id,
        action="suggestion.update",
        target_type="post",
        target_id=post.id,
        details={"status": suggestion.status, "has_reply": bool(next_reply)},
    )

    db.commit()
    db.refresh(post)

    return success_response(
        {
            "post_id": post.id,
            "status": suggestion.status,
            "suggestion": _suggestion_payload(db, post.id),
        }
    )


@router.put("/posts/{post_id}/mutual-aid")
def update_mutual_aid(
    post_id: int,
    payload: MutualAidUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    post = db.get(Post, post_id)
    if post is None or post.deleted_at is not None:
        raise AppException(status_code=404, message="Post not found.", code="NOT_FOUND")
    board = db.get(Board, post.board_id)
    if board is None or board.board_type != "mutual_aid":
        raise AppException(status_code=400, message="This post is not a mutual-aid request.", code="BAD_REQUEST")

    mutual_aid = db.scalar(select(PostMutualAid).where(PostMutualAid.post_id == post_id))
    if mutual_aid is None:
        raise AppException(status_code=404, message="Mutual-aid request not found.", code="NOT_FOUND")

    rejection_reason = payload.rejection_reason.strip() if payload.rejection_reason else None
    if payload.status == "rejected" and not rejection_reason:
        raise AppException(status_code=422, message="Rejection reason is required.", code="VALIDATION_ERROR")

    previous_status = mutual_aid.status
    mutual_aid.status = payload.status
    mutual_aid.rejection_reason = rejection_reason if payload.status == "rejected" else None
    mutual_aid.reviewed_by = current_user.id
    mutual_aid.reviewed_at = utc_now()

    # 처리중 전환은 알리지 않는다 — 승인/반려 같은 결과 상태만 알림.
    if previous_status != payload.status and payload.status != "processing":
        create_notification(
            db,
            user_id=post.author_id,
            actor_id=current_user.id,
            notification_type="council",
            message=MUTUAL_AID_MESSAGES[payload.status],
            post_id=post.id,
            setting_field="notify_council",
        )

    log_admin_action(
        db,
        actor_id=current_user.id,
        action="mutual_aid.update",
        target_type="post",
        target_id=post.id,
        details={"status": payload.status},
    )

    db.commit()
    db.refresh(mutual_aid)
    return success_response({"post_id": post.id, "mutual_aid": _mutual_aid_payload(db, post.id)})

