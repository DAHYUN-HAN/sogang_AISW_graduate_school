from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.account_deletion import delete_user_account
from app.author_snapshots import resolve_author_display
from app.board_policies import hides_author_identity
from app.deps import get_current_user, get_db, require_admin
from app.errors import AppException
from app.media_service import media_access_reference, profile_image_media_id, validate_profile_image_reference
from app.models.board import Board
from app.models.bookmark import Bookmark
from app.models.comment import Comment
from app.models.auth import PasswordResetToken, RefreshToken
from app.models.post import Post
from app.models.notification import PushToken
from app.models.registration import MajorOption
from app.models.user import User
from app.models.user_block import UserBlock
from app.post_access import post_read_filter
from app.rate_limit import enforce_rate_limit
from app.response import success_response
from app.schemas.user import AdminUserPasswordReset, AdminUserUpdate, UserBlockCreate, UserDeleteRequest, UserMeUpdate, UserPasswordUpdate, UserPasswordVerify
from app.security import ensure_password_policy, hash_password, utc_now, verify_password
from app.user_validation import normalize_nickname
from app.audit import log_admin_action

router = APIRouter()


@router.get("/nickname-availability")
def nickname_availability(
    nickname: str = Query(..., min_length=1, max_length=50),
    _: User = Depends(get_current_user),
):
    normalized = normalize_nickname(nickname)
    return success_response(
        {
            "nickname": normalized,
            # Kept for older clients. Display names represent real names, so
            # duplicates are valid and this endpoint now checks only presence.
            "available": bool(normalized),
        }
    )


@router.get('/me')
def get_me(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return success_response(
        {
            "id": user.id,
            "nickname": user.nickname,
            "cohort": user.cohort,
            "major": user.major,
            "phone": user.phone,
            "company": user.company,
            "job_title": user.job_title,
            "position": user.position,
            "profile_image_url": user.profile_image_url,
            "profile_image_media_id": profile_image_media_id(db, user),
            "email": user.email,
            "role": user.role,
            "created_at": user.created_at,
            "privacy_policy_version": user.privacy_policy_version,
            "privacy_consented_at": user.privacy_consented_at,
        }
    )


@router.get("/search")
def search_users(
    q: str = Query(..., min_length=1),
    size: int = Query(8, ge=1, le=20),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    trimmed = q.strip()
    if not trimmed:
        return success_response([])
    keyword = f"%{trimmed}%"
    users = db.scalars(
        select(User)
        .where(
            User.is_active.is_(True),
            User.enrollment_status == "active",
            User.dues_status.in_(["paid", "exempt"]),
            User.nickname.ilike(keyword) | User.cohort.ilike(keyword) | User.major.ilike(keyword),
        )
        .order_by(User.cohort.desc().nullslast(), User.nickname.asc(), User.id.asc())
        .limit(size)
    ).all()

    return success_response(
        [
            {
                "id": item.id,
                "nickname": item.nickname,
                "cohort": item.cohort,
                "major": item.major,
            }
            for item in users
        ]
    )


@router.get("/admin/users")
def get_admin_users(
    q: str | None = Query(None, min_length=1),
    role: str | None = Query(None, pattern="^(user|admin)$"),
    is_active: bool | None = None,
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    filters = []
    if q and q.strip():
        keyword = f"%{q.strip()}%"
        filters.append(User.email.ilike(keyword) | User.nickname.ilike(keyword) | User.cohort.ilike(keyword))
    if role:
        filters.append(User.role == role)
    if is_active is not None:
        filters.append(User.is_active.is_(is_active))

    total = db.scalar(select(func.count(User.id)).where(*filters)) or 0
    users = db.scalars(
        select(User)
        .where(*filters)
        .order_by(User.created_at.desc(), User.id.desc())
        .offset((page - 1) * size)
        .limit(size)
    ).all()
    total_pages = (total + size - 1) // size if total else 0

    return success_response(
        [
            {
                "id": item.id,
                "email": item.email,
                "nickname": item.nickname,
                "cohort": item.cohort,
                "major": item.major,
                "phone": item.phone,
                "company": item.company,
                "job_title": item.job_title,
                "position": item.position,
                "role": item.role,
                "is_active": item.is_active,
                "enrollment_status": item.enrollment_status,
                "last_login_at": item.last_login_at,
                "created_at": item.created_at,
                "privacy_policy_version": item.privacy_policy_version,
                "privacy_consented_at": item.privacy_consented_at,
            }
            for item in users
        ],
        pagination={"page": page, "size": size, "total": total, "total_pages": total_pages},
    )


@router.put("/admin/users/{user_id}")
def update_admin_user(
    user_id: int,
    payload: AdminUserUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    target_user = db.get(User, user_id)
    if target_user is None:
        raise AppException(status_code=404, message="User not found.", code="NOT_FOUND")

    data = payload.model_dump(exclude_unset=True)
    if "role" in data and target_user.id == admin.id and data["role"] != "admin":
        raise AppException(status_code=400, message="You cannot remove your own admin role.", code="BAD_REQUEST")
    if "is_active" in data and target_user.id == admin.id and data["is_active"] is False:
        raise AppException(status_code=400, message="You cannot deactivate your own account here.", code="BAD_REQUEST")

    data = {key: value for key, value in data.items() if getattr(target_user, key) != value}
    if "major" in data:
        active_major = db.scalar(
            select(MajorOption.name).where(MajorOption.name == data["major"], MajorOption.is_active.is_(True))
        )
        if active_major is None:
            raise AppException(status_code=422, message="Active major option is required.", code="VALIDATION_ERROR")

    for key, value in data.items():
        setattr(target_user, key, value)

    if data:
        log_admin_action(
            db,
            actor_id=admin.id,
            action="user.update",
            target_type="user",
            target_id=target_user.id,
            details={"changed_fields": sorted(data), **{
                key: value for key, value in data.items() if key in {"role", "is_active", "enrollment_status"}
            }},
        )

    db.commit()
    db.refresh(target_user)

    return success_response(
        {
            "id": target_user.id,
            "role": target_user.role,
            "is_active": target_user.is_active,
        }
    )


@router.put("/admin/users/{user_id}/password")
def reset_admin_user_password(
    user_id: int,
    payload: AdminUserPasswordReset,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    enforce_rate_limit(
        request,
        action="admin.password_reset",
        subject=f"{admin.id}:{user_id}",
        limit=10,
        ip_limit=30,
        window_seconds=900,
    )
    target_user = db.scalar(select(User).where(User.id == user_id).with_for_update().execution_options(populate_existing=True))
    if target_user is None:
        raise AppException(status_code=404, message="User not found.", code="NOT_FOUND")
    ensure_password_policy(payload.new_password)
    target_user.password_hash = hash_password(payload.new_password)
    now = utc_now()
    refresh_tokens = db.scalars(
        select(RefreshToken).where(RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None))
    ).all()
    for token in refresh_tokens:
        token.revoked_at = now
    push_tokens = db.scalars(
        select(PushToken).where(PushToken.user_id == user_id, PushToken.is_active.is_(True))
    ).all()
    for token in push_tokens:
        token.is_active = False
    reset_tokens = db.scalars(
        select(PasswordResetToken).where(PasswordResetToken.user_id == user_id, PasswordResetToken.consumed_at.is_(None))
    ).all()
    for token in reset_tokens:
        token.consumed_at = now
    counts = {
        "sessions_revoked": len(refresh_tokens),
        "push_tokens_deactivated": len(push_tokens),
        "reset_tokens_invalidated": len(reset_tokens),
    }
    log_admin_action(
        db, actor_id=admin.id, action="user.password_reset", target_type="user", target_id=user_id, details=counts,
    )
    db.commit()
    return success_response({"id": user_id, "changed": True, **counts})


@router.put('/me')
def update_me(payload: UserMeUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    data = payload.model_dump(exclude_unset=True)
    if "profile_image_url" in data:
        profile_reference = (data["profile_image_url"] or "").strip()
        if not profile_reference:
            data["profile_image_url"] = None
        else:
            profile_media = validate_profile_image_reference(db, profile_reference, user)
            data["profile_image_url"] = media_access_reference(profile_media.id)
    if "major" in data:
        major = (data["major"] or "").strip()
        active_major = db.scalar(
            select(MajorOption.name).where(MajorOption.name == major, MajorOption.is_active.is_(True))
        )
        if active_major is None:
            raise AppException(status_code=422, message="Active major option is required.", code="VALIDATION_ERROR")
        data["major"] = active_major
    for key, value in data.items():
        setattr(user, key, value)

    db.commit()
    db.refresh(user)

    return success_response({"id": user.id})


@router.get('/me/activity')
def get_my_activity(
    activity_type: str | None = Query(None, alias="type", pattern="^(posts|comments|bookmarks)$"),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    offset = (page - 1) * size

    if activity_type == "comments":
        total = (
            db.scalar(
                select(func.count(Comment.id))
                .join(Post, Post.id == Comment.post_id)
                .join(Board, Board.id == Post.board_id)
                .where(Comment.author_id == user.id, Post.deleted_at.is_(None), post_read_filter(user))
            )
            or 0
        )
        comments = db.execute(
            select(Comment, Post.title, Post.board_id, Board.name, Post.comment_count, Post.like_count, Post.category)
            .join(Post, Post.id == Comment.post_id)
            .join(Board, Board.id == Post.board_id)
            .where(Comment.author_id == user.id, Post.deleted_at.is_(None), post_read_filter(user))
            .order_by(Comment.created_at.desc(), Comment.id.desc())
            .offset(offset)
            .limit(size)
        ).all()
        data = [
            {
                "type": "comment",
                "id": comment.id,
                "post_id": comment.post_id,
                "title": title,
                "content_preview": comment.content[:100],
                "board_id": board_id,
                "board_name": board_name,
                "category": category,
                "comment_count": comment_count,
                "like_count": like_count,
                "created_at": comment.created_at,
            }
            for comment, title, board_id, board_name, comment_count, like_count, category in comments
        ]
    elif activity_type == "bookmarks":
        total = (
            db.scalar(
                select(func.count(Bookmark.id))
                .join(Post, Post.id == Bookmark.post_id)
                .join(Board, Board.id == Post.board_id)
                .where(Bookmark.user_id == user.id, Post.deleted_at.is_(None), post_read_filter(user))
            )
            or 0
        )
        bookmarks = db.execute(
            select(Bookmark, Post, Board, User.nickname, User.cohort)
            .join(Post, Post.id == Bookmark.post_id)
            .join(Board, Board.id == Post.board_id)
            .outerjoin(User, User.id == Post.author_id)
            .where(Bookmark.user_id == user.id, Post.deleted_at.is_(None), post_read_filter(user))
            .order_by(Bookmark.created_at.desc(), Bookmark.id.desc())
            .offset(offset)
            .limit(size)
        ).all()
        data = [
            {
                "type": "bookmark",
                "id": bookmark.id,
                "post_id": post.id,
                "title": post.title,
                "content_preview": post.content[:100],
                "board_id": post.board_id,
                "board_name": board.name,
                "category": post.category,
                "comment_count": post.comment_count,
                "like_count": post.like_count,
                "author_nickname": (
                    "Anonymous"
                    if user.role != "admin" and (post.is_anonymous or hides_author_identity(board))
                    else resolve_author_display(
                        live_nickname=author_nickname,
                        live_cohort=author_cohort,
                        snapshot_nickname=post.author_nickname_snapshot,
                        snapshot_cohort=post.author_cohort_snapshot,
                    ).nickname
                ),
                "author_cohort": None
                if user.role != "admin" and (post.is_anonymous or hides_author_identity(board))
                else resolve_author_display(
                    live_nickname=author_nickname,
                    live_cohort=author_cohort,
                    snapshot_nickname=post.author_nickname_snapshot,
                    snapshot_cohort=post.author_cohort_snapshot,
                ).cohort,
                "created_at": post.created_at,
            }
            for bookmark, post, board, author_nickname, author_cohort in bookmarks
        ]
    else:
        filters = [Post.author_id == user.id, Post.deleted_at.is_(None), post_read_filter(user)]
        total = db.scalar(
            select(func.count(Post.id)).join(Board, Board.id == Post.board_id).where(*filters)
        ) or 0
        posts = db.execute(
            select(Post, Board.name)
            .join(Board, Board.id == Post.board_id)
            .where(*filters)
            .order_by(Post.created_at.desc(), Post.id.desc())
            .offset(offset)
            .limit(size)
        ).all()
        data = [
            {
                "type": "post",
                "id": post.id,
                "post_id": post.id,
                "title": post.title,
                "content_preview": post.content[:100],
                "board_id": post.board_id,
                "board_name": board_name,
                "category": post.category,
                "comment_count": post.comment_count,
                "like_count": post.like_count,
                "created_at": post.created_at,
            }
            for post, board_name in posts
        ]

    total_pages = (total + size - 1) // size if total else 0
    return success_response(data, pagination={"page": page, "size": size, "total": total, "total_pages": total_pages})


@router.get("/me/blocks")
def get_my_blocks(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = db.execute(
        select(UserBlock, User.nickname)
        .join(User, User.id == UserBlock.blocked_user_id)
        .where(UserBlock.blocker_id == user.id)
        .order_by(UserBlock.created_at.desc(), UserBlock.id.desc())
    ).all()
    return success_response(
        [
            {
                "id": block.id,
                "blocked_user_id": block.blocked_user_id,
                "blocked_user_nickname": nickname,
                "reason": block.reason,
                "created_at": block.created_at,
            }
            for block, nickname in rows
        ]
    )


@router.post("/me/blocks")
def block_user(payload: UserBlockCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if payload.blocked_user_id == user.id:
        raise AppException(status_code=400, message="You cannot block yourself.", code="BAD_REQUEST")

    target_user = db.get(User, payload.blocked_user_id)
    if target_user is None or not target_user.is_active:
        raise AppException(status_code=404, message="User not found.", code="NOT_FOUND")

    existing = db.scalar(
        select(UserBlock).where(
            UserBlock.blocker_id == user.id,
            UserBlock.blocked_user_id == payload.blocked_user_id,
        )
    )
    if existing is not None:
        return success_response(
            {
                "id": existing.id,
                "blocked_user_id": existing.blocked_user_id,
                "duplicate": True,
            }
        )

    block = UserBlock(blocker_id=user.id, blocked_user_id=payload.blocked_user_id, reason=payload.reason)
    db.add(block)
    db.commit()
    db.refresh(block)

    return success_response({"id": block.id, "blocked_user_id": block.blocked_user_id, "duplicate": False})


@router.delete("/me/blocks/{blocked_user_id}")
def unblock_user(blocked_user_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    block = db.scalar(
        select(UserBlock).where(
            UserBlock.blocker_id == user.id,
            UserBlock.blocked_user_id == blocked_user_id,
        )
    )
    if block is not None:
        db.delete(block)
        db.commit()

    return success_response({"blocked_user_id": blocked_user_id, "blocked": False})


@router.post('/me/password/verify')
def verify_current_password(payload: UserPasswordVerify, user: User = Depends(get_current_user)):
    return success_response({"valid": verify_password(payload.current_password, user.password_hash)})


@router.put('/me/password')
def update_password(payload: UserPasswordUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    user = db.scalar(select(User).where(User.id == user.id).with_for_update().execution_options(populate_existing=True))
    if user is None or not user.is_active:
        raise AppException(status_code=401, message="Invalid account.", code="UNAUTHORIZED")
    if not verify_password(payload.current_password, user.password_hash):
        raise AppException(status_code=403, message="Current password is invalid.", code="FORBIDDEN")
    ensure_password_policy(payload.new_password)

    user.password_hash = hash_password(payload.new_password)
    now = utc_now()
    refresh_tokens = db.scalars(
        select(RefreshToken).where(RefreshToken.user_id == user.id, RefreshToken.revoked_at.is_(None))
    ).all()
    for refresh_token in refresh_tokens:
        refresh_token.revoked_at = now
    push_tokens = db.scalars(select(PushToken).where(PushToken.user_id == user.id, PushToken.is_active.is_(True))).all()
    for push_token in push_tokens:
        push_token.is_active = False
    db.commit()

    return success_response({"changed": True, "sessions_revoked": len(refresh_tokens), "push_tokens_deactivated": len(push_tokens)})


@router.delete('/me')
def delete_me(
    payload: UserDeleteRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    enforce_rate_limit(
        request,
        action="account.delete.authenticated",
        subject=str(user.id),
        limit=5,
        ip_limit=10,
        window_seconds=3600,
    )
    result = delete_user_account(
        db,
        user_id=user.id,
        current_password=payload.current_password,
        channel="authenticated",
    )
    return success_response(
        {
            "deleted": True,
            "receipt_id": result.receipt_id,
            "completed_at": result.completed_at,
        }
    )

