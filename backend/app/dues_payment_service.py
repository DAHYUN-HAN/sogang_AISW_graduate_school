from typing import Literal

from sqlalchemy import delete, func, select, text
from sqlalchemy.orm import Session

from app.dues_payer_import import DuesPayerRow
from app.errors import AppException
from app.models.board import Board
from app.models.dues_payment import DuesPayment
from app.models.student_roster import StudentRosterMember


PaymentScope = Literal["ALL", "ONCE", "UNPAID"]


def lock_dues_mutation(db: Session) -> None:
    bind = db.get_bind()
    if bind.dialect.name == "postgresql":
        db.execute(text("SELECT pg_advisory_xact_lock(hashtext('aisw-dues-payer-mutations'))"))


def payment_scope(payment: DuesPayment | None) -> PaymentScope:
    if payment is None:
        return "UNPAID"
    if payment.scope == "ALL":
        return "ALL"
    return "ONCE"


def require_activity_dues_board(db: Session, board_id: int) -> Board:
    board = db.get(Board, board_id)
    if board is None or not board.is_active or board.board_type != "activity_certification":
        raise AppException(
            status_code=422,
            message="Select an active activity certification board.",
            code="INVALID_DUES_BOARD",
        )
    return board


def set_payment_scope(
    db: Session,
    member: StudentRosterMember,
    scope: PaymentScope,
    once_board_id: int | None,
) -> tuple[DuesPayment | None, Board | None]:
    payment = db.scalar(
        select(DuesPayment)
        .where(DuesPayment.roster_member_id == member.id)
        .with_for_update()
    )

    if scope == "UNPAID" and once_board_id is None:
        if payment is not None:
            db.delete(payment)
        return None, None

    if scope == "ALL" and once_board_id is None:
        if payment is None:
            payment = DuesPayment(roster_member_id=member.id, scope="ALL")
            db.add(payment)
        else:
            payment.scope = "ALL"
            payment.once_board_id = None
        return payment, None

    if scope == "ONCE" and once_board_id is not None:
        board = require_activity_dues_board(db, once_board_id)
        if payment is None:
            payment = DuesPayment(
                roster_member_id=member.id,
                scope="ONCE",
                once_board_id=board.id,
            )
            db.add(payment)
        else:
            payment.scope = "ONCE"
            payment.once_board_id = board.id
        return payment, board

    raise AppException(
        status_code=422,
        message="Invalid payment scope.",
        code="INVALID_DUES_SCOPE",
    )


def replace_payment_snapshot(db: Session, rows: list[DuesPayerRow]) -> dict[str, int]:
    members = db.scalars(select(StudentRosterMember).with_for_update()).all()
    by_student_number = {member.student_number: member for member in members}

    for row in rows:
        member = by_student_number.get(row.student_number)
        if member is None or member.name.strip() != row.name:
            raise AppException(
                status_code=422,
                message=f"Row {row.row_number} does not exactly match the registered roster.",
                code="DUES_IMPORT_ROSTER_MISMATCH",
            )

    cleared = db.scalar(select(func.count(DuesPayment.id))) or 0
    db.execute(delete(DuesPayment))
    db.add_all(
        [
            DuesPayment(
                roster_member_id=by_student_number[row.student_number].id,
                scope="ALL",
            )
            for row in rows
        ]
    )
    return {
        "cleared": cleared,
        "registered": len(rows),
        "total_rows": len(rows),
    }
