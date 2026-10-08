from collections import defaultdict

from fastapi import APIRouter, Depends
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps import can_read_board, get_current_user, get_db, require_admin
from app.errors import AppException
from app.models.board import Board
from app.models.post import Post
from app.models.poll import PostPoll
from app.models.user import User
from app.response import success_response
from app.schemas.board import (
    ACTIVITY_IMAGE_LAYOUT_KEY,
    ActivityImageLayout,
    BoardAdminCreate,
    BoardAdminUpdate,
)
from app.audit import log_admin_action
from app.board_navigation import validate_navigation, deactivate_tree, descendants, lock_navigation_mutations

router = APIRouter()


def _validate_activity_image_layout(board_type: str, metadata: dict | None) -> None:
    if metadata is None or ACTIVITY_IMAGE_LAYOUT_KEY not in metadata:
        return
    if board_type != "activity_certification":
        raise AppException(
            status_code=422,
            message="Activity image layout is only allowed for activity certification boards.",
            code="INVALID_ACTIVITY_IMAGE_LAYOUT",
        )
    try:
        ActivityImageLayout.model_validate(metadata[ACTIVITY_IMAGE_LAYOUT_KEY])
    except ValidationError as exc:
        raise AppException(
            status_code=422,
            message="Invalid activity image layout.",
            code="INVALID_ACTIVITY_IMAGE_LAYOUT",
        ) from exc


def _board_payload(board: Board) -> dict:
    return {
        "id": board.id,
        "name": board.name,
        "slug": board.slug,
        "category": board.category,
        "board_type": board.board_type,
        "description": board.description,
        "sort_order": board.sort_order,
        "allow_anonymous": board.allow_anonymous,
        "read_permission": board.read_permission,
        "write_permission": board.write_permission,
        "metadata": board.metadata_json,
        "is_active": board.is_active,
        "created_at": board.created_at,
    }


@router.get("")
def get_boards(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    boards = db.scalars(
        select(Board).where(Board.is_active.is_(True)).order_by(Board.sort_order.asc(), Board.id.asc())
    ).all()

    grouped: dict[str, list[dict]] = defaultdict(list)
    for board in boards:
        if not can_read_board(current_user, board.read_permission):
            continue
        grouped[board.category].append(_board_payload(board))

    data = [{"category": category, "boards": items} for category, items in grouped.items()]
    return success_response(data)


@router.get("/admin/all")
def get_admin_boards(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    boards = db.scalars(select(Board).order_by(Board.sort_order.asc(), Board.id.asc())).all()
    return success_response([_board_payload(board) for board in boards])


@router.post("/admin")
def create_admin_board(payload: BoardAdminCreate, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    lock_navigation_mutations(db)
    existing_board = db.scalar(select(Board.id).where(Board.slug == payload.slug))
    if existing_board is not None:
        raise AppException(status_code=409, message="Board slug already exists.", code="CONFLICT")

    data = payload.model_dump()
    metadata = data.pop("metadata", None)
    _validate_activity_image_layout(data["board_type"], metadata)
    board = Board(**data, metadata_json=metadata)
    validate_navigation(db, board)
    db.add(board)
    db.flush()
    log_admin_action(db, actor_id=admin.id, action="board.create", target_type="board", target_id=board.id)
    db.commit()
    db.refresh(board)
    return success_response(_board_payload(board))


@router.put("/admin/{board_id}")
def update_admin_board(
    board_id: int,
    payload: BoardAdminUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    lock_navigation_mutations(db)
    board = db.scalar(select(Board).where(Board.id == board_id).with_for_update().execution_options(populate_existing=True))
    if board is None:
        raise AppException(status_code=404, message="Board not found.", code="NOT_FOUND")

    data = payload.model_dump(exclude_unset=True)
    final_board_type = data.get("board_type", board.board_type)
    if final_board_type != "notice" and db.scalar(
        select(PostPoll.id).join(Post, Post.id == PostPoll.post_id).where(Post.board_id == board.id).limit(1)
    ) is not None:
        raise AppException(status_code=422, code="POLL_NOTICE_ONLY",
                           message="투표가 있는 게시판은 공지사항 유형을 유지해 주세요.")
    final_metadata = data["metadata"] if "metadata" in data else board.metadata_json
    _validate_activity_image_layout(final_board_type, final_metadata)
    if "metadata" in data:
        board.metadata_json = data.pop("metadata")
    for key, value in data.items():
        setattr(board, key, value)
    if board.is_active is False:
        deactivate_tree(db, board.id)
    validate_navigation(db, board)
    for child in descendants(db, board.id):
        validate_navigation(db, child)
    log_admin_action(db, actor_id=admin.id, action="board.update", target_type="board", target_id=board.id)
    db.commit()
    db.refresh(board)
    return success_response(_board_payload(board))


@router.delete("/admin/{board_id}")
def remove_admin_board(board_id: int, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    lock_navigation_mutations(db)
    if db.get(Board, board_id) is None:
        raise AppException(status_code=404, message="Board not found.", code="NOT_FOUND")
    affected = deactivate_tree(db, board_id)
    log_admin_action(db, actor_id=admin.id, action="board.archive", target_type="board", target_id=board_id,
                     details={"board_ids": affected})
    db.commit()
    return success_response({"id": board_id, "is_active": False, "board_ids": affected})


@router.get("/{board_id}")
def get_board_detail(board_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    board = db.get(Board, board_id)
    if board is None or not board.is_active:
        raise AppException(status_code=404, message="Board not found.", code="NOT_FOUND")
    if not can_read_board(current_user, board.read_permission):
        raise AppException(status_code=403, message="Forbidden.", code="FORBIDDEN")

    return success_response(_board_payload(board))

