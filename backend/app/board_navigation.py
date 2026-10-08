"""Optional administrator placement in existing board metadata; no content is moved."""
from sqlalchemy import select, text
from sqlalchemy.orm import Session
from app.errors import AppException
from app.models.board import Board

SECTIONS = {
    "executives": {"gsa", "council"}, "accounting": {"gsa", "council"},
    "mutual-aid": {"gsa", "council"}, "cohort-leaders": {"gsa", "council"},
    "past-councils": {"gsa", "council"}, "suggestions": {"gsa", "council"}, "faq": {"gsa", "council"},
    "club": {"club", "participation"}, "study": {"study", "participation"},
    "networking": {"alumni", "participation"}, "album": {"community"},
    "resources": {"resources"}, "notices": {"notices"},
}
SLUG_SECTIONS = {
    "gsa-executives": "executives", "accounting": "accounting", "mutual-aid": "mutual-aid",
    "gsa-cohort-leaders": "cohort-leaders", "gsa-past-councils": "past-councils",
    "suggestions": "suggestions", "gsa-faq": "faq", "club-promo": "club", "club-activity": "club",
    "study-recruit": "study", "study-activity": "study", "networking-programs": "networking",
    "networking-activity": "networking", "event-album": "album",
}


def lock_navigation_mutations(db: Session) -> None:
    """Serialize hierarchy validation and writes before acquiring board locks."""
    if db.get_bind().dialect.name == "postgresql":
        db.execute(text("SELECT pg_advisory_xact_lock(hashtext('aisw-board-navigation-mutations'))"))

def navigation(board: Board) -> dict:
    value = (board.metadata_json or {}).get("admin_navigation")
    return value if isinstance(value, dict) else {}

def section(board: Board) -> str | None:
    stored = navigation(board).get("section")
    if isinstance(stored, str) and stored in SECTIONS:
        return stored
    if board.slug in SLUG_SECTIONS:
        return SLUG_SECTIONS[board.slug]
    if board.category == "resources" and board.board_type == "resource":
        return "resources"
    if board.category == "notices" and board.board_type == "notice":
        return "notices"
    return None

def parent_id(board: Board) -> int | None:
    value = navigation(board).get("parent_board_id")
    return value if type(value) is int and value > 0 else None

def validate_navigation(db: Session, board: Board) -> None:
    raw = (board.metadata_json or {}).get("admin_navigation")
    if raw is None:
        return
    def invalid():
        raise AppException(status_code=422, code="INVALID_BOARD_PARENT", message="Select a valid active parent in the same board section.")
    if not isinstance(raw, dict) or not isinstance(raw.get("section"), str) or raw["section"] not in SECTIONS:
        invalid()
    if board.category not in SECTIONS[raw["section"]]:
        invalid()
    value = raw.get("parent_board_id")
    if value is not None and (type(value) is not int or value <= 0):
        invalid()
    seen = {board.id} if board.id else set()
    while value is not None:
        if value in seen:
            invalid()
        seen.add(value)
        parent = db.get(Board, value)
        if parent is None or section(parent) != raw["section"] or (board.is_active and not parent.is_active):
            invalid()
        value = parent_id(parent)

def descendants(db: Session, board_id: int) -> list[Board]:
    boards = list(db.scalars(select(Board)).all())
    selected = {board_id}
    changed = True
    while changed:
        changed = False
        for board in boards:
            if parent_id(board) in selected and board.id not in selected:
                selected.add(board.id)
                changed = True
    return [board for board in boards if board.id in selected]

def deactivate_tree(db: Session, board_id: int) -> list[int]:
    boards = descendants(db, board_id)
    for board in boards:
        board.is_active = False
    return [board.id for board in boards]
