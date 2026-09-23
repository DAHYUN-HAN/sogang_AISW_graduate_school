from pathlib import Path

from fastapi import APIRouter, Depends, File, Query, UploadFile
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.audit import log_admin_action
from app.config import settings
from app.deps import get_current_user, get_db, require_admin
from app.dues_payer_import import parse_dues_payer_workbook
from app.dues_payment_service import (
    lock_dues_mutation,
    payment_scope,
    replace_payment_snapshot,
    require_activity_dues_board,
    set_payment_scope,
)
from app.errors import AppException
from app.models.board import Board
from app.models.dues_payment import DuesPayment
from app.models.student_roster import StudentRosterMember
from app.models.user import User
from app.response import success_response
from app.schemas.dues_payer import DuesPaymentWriteRequest
from app.student_roster_service import import_roster


router = APIRouter()


def require_dues_mutation_admin(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> User:
    lock_dues_mutation(db)
    return admin


async def _parse_workbook_upload(file: UploadFile):
    try:
        if Path(file.filename or "").suffix.lower() != ".xlsx":
            raise AppException(
                status_code=422,
                message="Only .xlsx workbooks are supported.",
                code="INVALID_DUES_WORKBOOK",
            )
        content = await file.read(settings.media_upload_max_bytes + 1)
        if len(content) > settings.media_upload_max_bytes:
            raise AppException(
                status_code=413,
                message="The workbook is too large.",
                code="PAYLOAD_TOO_LARGE",
            )
        return parse_dues_payer_workbook(content)
    finally:
        await file.close()


def _roster_payload(member: StudentRosterMember) -> dict:
    return {
        "id": member.id,
        "name": member.name,
        "major": member.major,
        "student_number": member.student_number,
    }


def _payment_payload(
    member: StudentRosterMember,
    payment: DuesPayment | None,
    board_name: str | None,
) -> dict:
    return {
        **_roster_payload(member),
        "payment_scope": payment_scope(payment),
        "once_board_id": payment.once_board_id if payment is not None else None,
        "once_board_name": board_name,
    }


def _identity_filters(q: str | None):
    if not q or not q.strip():
        return []
    keyword = f"%{q.strip()}%"
    return [
        or_(
            StudentRosterMember.name.ilike(keyword),
            StudentRosterMember.student_number.ilike(keyword),
            StudentRosterMember.major.ilike(keyword),
        )
    ]


@router.get("/search")
def search_dues_payers(
    q: str = Query(..., min_length=1),
    board_id: int | None = Query(None, ge=1),
    size: int = Query(8, ge=1, le=20),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    if board_id is None:
        raise AppException(
            status_code=422,
            message="Select an active activity certification board.",
            code="INVALID_DUES_BOARD",
        )
    board = require_activity_dues_board(db, board_id)
    trimmed = q.strip()
    if not trimmed:
        return success_response([])
    keyword = f"%{trimmed}%"
    rows = db.execute(
        select(StudentRosterMember, DuesPayment)
        .outerjoin(DuesPayment, DuesPayment.roster_member_id == StudentRosterMember.id)
        # 참가자 검색은 이름으로만 매칭한다. 학번 매칭은 다른 원우의 학번을 유추하는 통로가 된다.
        .where(StudentRosterMember.name.ilike(keyword))
        .order_by(
            StudentRosterMember.name.asc(),
            StudentRosterMember.student_number.asc(),
            StudentRosterMember.id.asc(),
        )
        .limit(size)
    ).all()
    return success_response(
        [
            {
                **_roster_payload(member),
                "is_paid_for_board": bool(
                    payment
                    and (payment.scope == "ALL" or payment.once_board_id == board.id)
                ),
            }
            for member, payment in rows
        ]
    )


@router.get("/admin/roster")
def get_admin_roster(
    q: str | None = Query(None, min_length=1),
    page: int = Query(1, ge=1),
    size: int = Query(100, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    filters = _identity_filters(q)
    total = db.scalar(select(func.count(StudentRosterMember.id)).where(*filters)) or 0
    members = db.scalars(
        select(StudentRosterMember)
        .where(*filters)
        .order_by(
            StudentRosterMember.name.asc(),
            StudentRosterMember.student_number.asc(),
            StudentRosterMember.id.asc(),
        )
        .offset((page - 1) * size)
        .limit(size)
    ).all()
    total_pages = (total + size - 1) // size if total else 0
    return success_response(
        [_roster_payload(member) for member in members],
        pagination={"page": page, "size": size, "total": total, "total_pages": total_pages},
    )


@router.post("/admin/roster/import")
async def import_student_roster(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin: User = Depends(require_dues_mutation_admin),
):
    rows = await _parse_workbook_upload(file)
    result = import_roster(db, rows)
    log_admin_action(
        db,
        actor_id=admin.id,
        action="student_roster.import",
        target_type="student_roster",
        details=result,
    )
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise AppException(
            status_code=422,
            message="The roster changed while the workbook was being imported. Try again.",
            code="ROSTER_IDENTITY_CONFLICT",
        ) from exc
    return success_response(result)


@router.get("/admin/payments")
def get_admin_payments(
    q: str | None = Query(None, min_length=1),
    page: int = Query(1, ge=1),
    size: int = Query(100, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    filters = _identity_filters(q)
    total = db.scalar(select(func.count(StudentRosterMember.id)).where(*filters)) or 0
    rows = db.execute(
        select(StudentRosterMember, DuesPayment, Board.name)
        .outerjoin(DuesPayment, DuesPayment.roster_member_id == StudentRosterMember.id)
        .outerjoin(Board, Board.id == DuesPayment.once_board_id)
        .where(*filters)
        .order_by(
            StudentRosterMember.name.asc(),
            StudentRosterMember.student_number.asc(),
            StudentRosterMember.id.asc(),
        )
        .offset((page - 1) * size)
        .limit(size)
    ).all()
    total_pages = (total + size - 1) // size if total else 0
    return success_response(
        [_payment_payload(member, payment, board_name) for member, payment, board_name in rows],
        pagination={"page": page, "size": size, "total": total, "total_pages": total_pages},
    )


@router.post("/admin/payments/import")
async def import_current_payments(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin: User = Depends(require_dues_mutation_admin),
):
    rows = await _parse_workbook_upload(file)
    result = replace_payment_snapshot(db, rows)
    log_admin_action(
        db,
        actor_id=admin.id,
        action="dues_payment.import",
        target_type="dues_payment",
        details=result,
    )
    db.commit()
    return success_response(result)


@router.put("/admin/payments/{roster_member_id:int}")
def update_current_payment(
    roster_member_id: int,
    payload: DuesPaymentWriteRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_dues_mutation_admin),
):
    member = db.scalar(
        select(StudentRosterMember)
        .where(StudentRosterMember.id == roster_member_id)
        .with_for_update()
    )
    if member is None:
        raise AppException(
            status_code=404,
            message="Roster member not found.",
            code="ROSTER_MEMBER_NOT_FOUND",
        )

    payment, board = set_payment_scope(
        db,
        member,
        payload.payment_scope,
        payload.once_board_id,
    )
    log_admin_action(
        db,
        actor_id=admin.id,
        action="dues_payment.update",
        target_type="student_roster",
        target_id=member.id,
        details={
            "roster_member_id": member.id,
            "payment_scope": payment_scope(payment),
            "once_board_id": payment.once_board_id if payment is not None else None,
        },
    )
    db.commit()
    return success_response(_payment_payload(member, payment, board.name if board else None))
