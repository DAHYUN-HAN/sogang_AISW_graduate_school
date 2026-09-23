from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.dues_payer_import import DuesPayerRow
from app.errors import AppException
from app.models.board import Board
from app.models.dues_payer import DuesPayer


def lock_dues_payer_mutation(db: Session) -> None:
    bind = db.get_bind()
    if bind.dialect.name == "postgresql":
        db.execute(text("SELECT pg_advisory_xact_lock(hashtext('aisw-dues-payer-mutations'))"))


def payment_scope(item: DuesPayer) -> str:
    if item.is_full_paid:
        return "ALL"
    if item.once_board_id is not None:
        return "ONCE"
    return "UNPAID"


def require_activity_dues_board(db: Session, board_id: int) -> Board:
    board = db.get(Board, board_id)
    if board is None or not board.is_active or board.board_type != "activity_certification":
        raise AppException(
            status_code=422,
            message="Select an active activity certification board.",
            code="INVALID_DUES_BOARD",
        )
    return board


def apply_payment_scope(
    db: Session,
    item: DuesPayer,
    scope: str,
    once_board_id: int | None,
) -> Board | None:
    if scope == "ALL" and once_board_id is None:
        item.is_full_paid = True
        item.once_board_id = None
        return None
    if scope == "UNPAID" and once_board_id is None:
        item.is_full_paid = False
        item.once_board_id = None
        return None
    if scope == "ONCE" and once_board_id is not None:
        board = require_activity_dues_board(db, once_board_id)
        item.is_full_paid = False
        item.once_board_id = board.id
        return board
    raise AppException(
        status_code=422,
        message="Invalid payment scope.",
        code="INVALID_DUES_SCOPE",
    )


def import_roster(db: Session, rows: list[DuesPayerRow]) -> dict[str, int]:
    student_numbers = [row.student_number for row in rows]
    existing = {
        item.student_number: item
        for item in db.scalars(
            select(DuesPayer)
            .where(DuesPayer.student_number.in_(student_numbers))
            .with_for_update()
        ).all()
    }
    created = 0
    unchanged = 0
    for row in rows:
        item = existing.get(row.student_number)
        if item is not None and (item.name, item.major) != (row.name, row.major):
            raise AppException(
                status_code=422,
                message=f"Row {row.row_number} conflicts with the registered roster identity.",
                code="DUES_ROSTER_IDENTITY_CONFLICT",
            )

    for row in rows:
        item = existing.get(row.student_number)
        if item is None:
            db.add(
                DuesPayer(
                    name=row.name,
                    major=row.major,
                    student_number=row.student_number,
                    is_full_paid=False,
                    once_board_id=None,
                )
            )
            created += 1
        else:
            unchanged += 1

    return {
        "created": created,
        "updated": 0,
        "unchanged": unchanged,
        "total_rows": len(rows),
    }


def reset_full_payments(db: Session) -> dict[str, int]:
    full_payers = db.scalars(
        select(DuesPayer)
        .where(DuesPayer.is_full_paid.is_(True))
        .with_for_update()
    ).all()
    for item in full_payers:
        item.is_full_paid = False
    return {"reset": len(full_payers)}


def apply_full_payment_snapshot(db: Session, rows: list[DuesPayerRow]) -> dict[str, int]:
    roster = db.scalars(select(DuesPayer).with_for_update()).all()
    by_student_number = {item.student_number: item for item in roster}

    for row in rows:
        item = by_student_number.get(row.student_number)
        if item is None or item.name.strip() != row.name:
            raise AppException(
                status_code=422,
                message=f"Row {row.row_number} does not exactly match the registered roster.",
                code="DUES_IMPORT_ROSTER_MISMATCH",
            )

    matched_student_numbers = {row.student_number for row in rows}
    activated = 0
    reset = 0
    unchanged = 0

    for item in roster:
        if item.student_number in matched_student_numbers:
            if item.is_full_paid:
                unchanged += 1
            else:
                activated += 1
            item.is_full_paid = True
            item.once_board_id = None
        elif item.is_full_paid:
            item.is_full_paid = False
            reset += 1

    return {
        "activated": activated,
        "reset": reset,
        "unchanged": unchanged,
        "total_rows": len(rows),
    }
