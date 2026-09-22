from collections import defaultdict

from fastapi import APIRouter, Depends, Request
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.author_snapshots import resolve_author_display
from app.deps import get_current_user, get_db
from app.errors import AppException
from app.models.comment import Comment
from app.models.post import Post
from app.models.user import User
from app.models.user_block import UserBlock
from app.notifications import comment_message, create_notification
from app.post_access import require_comment_read, require_post_read
from app.response import success_response
from app.rate_limit import enforce_rate_limit
from app.schemas.comment import CommentCreate, CommentUpdate

router = APIRouter()


def _count_subtree(root_id: int, comments: list[Comment]) -> int:
    by_parent: dict[int | None, list[int]] = defaultdict(list)
    for comment in comments:
        by_parent[comment.parent_id].append(comment.id)

    count = 0
    stack = [root_id]
    while stack:
        cid = stack.pop()
        count += 1
        stack.extend(by_parent.get(cid, []))
    return count


@router.get("/posts/{post_id}/comments")
def get_comments(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    post = db.get(Post, post_id)
    if post is None or post.deleted_at is not None:
        raise AppException(status_code=404, message="Post not found.", code="NOT_FOUND")
    require_post_read(db, post, current_user)

    filters = [Comment.post_id == post_id]
    blocked_author_ids = db.scalars(
        select(UserBlock.blocked_user_id).where(UserBlock.blocker_id == current_user.id)
    ).all()
    if blocked_author_ids:
        filters.append(
            or_(
                Comment.author_id.is_(None),
                Comment.author_id.not_in(blocked_author_ids),
            )
        )

    comments = db.scalars(select(Comment).where(*filters).order_by(Comment.created_at.asc(), Comment.id.asc())).all()

    author_ids = list({comment.author_id for comment in comments if comment.author_id is not None})
    user_rows = (
        db.execute(select(User.id, User.nickname, User.cohort).where(User.id.in_(author_ids))).all()
        if author_ids
        else []
    )
    author_by_id = {
        user_id: {"nickname": nickname, "cohort": cohort}
        for user_id, nickname, cohort in user_rows
    }

    nodes: dict[int, dict] = {}
    roots: list[dict] = []

    for comment in comments:
        live_author = author_by_id.get(comment.author_id, {})
        author = resolve_author_display(
            live_nickname=live_author.get("nickname"),
            live_cohort=live_author.get("cohort"),
            snapshot_nickname=comment.author_nickname_snapshot,
            snapshot_cohort=comment.author_cohort_snapshot,
        )
        nodes[comment.id] = {
            "id": comment.id,
            "post_id": comment.post_id,
            "author_id": comment.author_id,
            "author_nickname": author.nickname,
            "author_cohort": author.cohort,
            "parent_id": comment.parent_id,
            "content": comment.content,
            "created_at": comment.created_at,
            "updated_at": comment.updated_at,
            "children": [],
        }

    for comment in comments:
        node = nodes[comment.id]
        if comment.parent_id is None or comment.parent_id not in nodes:
            roots.append(node)
        else:
            nodes[comment.parent_id]["children"].append(node)

    return success_response(roots)


@router.post("/posts/{post_id}/comments")
def create_comment(
    post_id: int,
    payload: CommentCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    enforce_rate_limit(request, action="comment.create", subject=str(current_user.id), limit=30, ip_limit=90, window_seconds=300)
    post = db.get(Post, post_id)
    if post is None or post.deleted_at is not None:
        raise AppException(status_code=404, message="Post not found.", code="NOT_FOUND")
    require_post_read(db, post, current_user)

    if payload.parent_id is not None:
        parent_comment = db.get(Comment, payload.parent_id)
        if parent_comment is None or parent_comment.post_id != post_id:
            raise AppException(status_code=400, message="Invalid parent comment.", code="BAD_REQUEST")
        if parent_comment.parent_id is not None:
            raise AppException(status_code=400, message="Comment replies support max depth 2.", code="BAD_REQUEST")

    comment = Comment(
        post_id=post_id,
        author_id=current_user.id,
        author_nickname_snapshot=current_user.nickname,
        author_cohort_snapshot=current_user.cohort,
        parent_id=payload.parent_id,
        content=payload.content,
    )
    db.add(comment)
    post.comment_count += 1
    create_notification(
        db,
        user_id=post.author_id,
        actor_id=current_user.id,
        notification_type="comment",
        message=comment_message(payload.content),
        post_id=post.id,
        setting_field="notify_comment",
    )
    db.commit()
    db.refresh(comment)

    return success_response({"id": comment.id})


@router.put("/comments/{comment_id}")
def update_comment(
    comment_id: int,
    payload: CommentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    comment, _, _ = require_comment_read(db, db.get(Comment, comment_id), current_user)
    if comment.author_id != current_user.id and current_user.role != "admin":
        raise AppException(status_code=403, message="Forbidden.", code="FORBIDDEN")

    comment.content = payload.content
    db.commit()
    db.refresh(comment)

    return success_response({"id": comment.id})


@router.delete("/comments/{comment_id}")
def delete_comment(comment_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    comment, post, _ = require_comment_read(db, db.get(Comment, comment_id), current_user)
    if comment.author_id != current_user.id and current_user.role != "admin":
        raise AppException(status_code=403, message="Forbidden.", code="FORBIDDEN")

    all_comments = db.scalars(select(Comment).where(Comment.post_id == post.id)).all()
    deleted_count = _count_subtree(comment.id, all_comments)

    db.delete(comment)
    post.comment_count = max(0, post.comment_count - deleted_count)
    db.commit()

    return success_response({"id": comment_id, "deleted_count": deleted_count})

