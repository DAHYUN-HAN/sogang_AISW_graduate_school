from pathlib import Path

from fastapi import APIRouter, Depends, File, Query, UploadFile
from sqlalchemy import delete, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.audit import log_admin_action
from app.config import settings
from app.deps import get_current_user, get_db, require_admin
from app.dues_payer_import import parse_dues_payer_workbook
from app.dues_payer_service import (
    apply_full_payment_snapshot,
    apply_payment_scope,
    import_roster,
    payment_scope,
)
from app.errors import AppException
from app.models.board import Board
from app.models.dues_payer import DuesPayer
from app.models.user import User
from app.response import success_response
from app.schemas.dues_payer import DuesPayerDeleteRequest, DuesPayerWriteRequest


router = APIRouter()


async def _parse_workbook_upload(file: UploadFile):
    try:
        if Path(file.filename or "").suffix.lower() != ".xlsx":
            raise AppException(
                status_code=422,
                message="Only .xlsx dues payer workbooks are supported.",
                code="INVALID_DUES_WORKBOOK",
            )
        content = await file.read(settings.media_upload_max_bytes + 1)
        if len(content) > settings.media_upload_max_bytes:
            raise AppException(
                status_code=413,
                message="The dues payer workbook is too large.",
                code="PAYLOAD_TOO_LARGE",
            )
        return parse_dues_payer_workbook(content)
    finally:
        await file.close()


def _dues_payer_payload(item: DuesPayer) -> dict:
    return {
        "id": item.id,
        "name": item.name,
        "major": item.major,
        "student_number": item.student_number,
    }


def _admin_dues_payer_payload(item: DuesPayer, board_name: str | None = None) -> dict:
    return {
        **_dues_payer_payload(item),
        "payment_scope": payment_scope(item),
        "is_full_paid": item.is_full_paid,
        "once_board_id": item.once_board_id,
        "once_board_name": board_name,
    }


def _commit_individual_change(db: Session) -> None:
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise AppException(
            status_code=409,
            message="A dues payer with this student number already exists.",
            code="DUES_STUDENT_NUMBER_CONFLICT",
        ) from exc


@router.get("/search")
def search_dues_payers(
    q: str = Query(..., min_length=1),
    size: int = Query(8, ge=1, le=20),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    trimmed = q.strip()
    if not trimmed:
        return success_response([])
    keyword = f"%{trimmed}%"
    payers = db.scalars(
        select(DuesPayer)
        # 참가자 검색은 이름으로만 매칭한다. 학번 매칭은 다른 원우의 학번을 유추하는 통로가 된다.
        .where(DuesPayer.name.ilike(keyword))
        .order_by(DuesPayer.name.asc(), DuesPayer.student_number.asc(), DuesPayer.id.asc())
        .limit(size)
    ).all()
    return success_response([_dues_payer_payload(item) for item in payers])


@router.get("/admin/payers")
def get_admin_dues_payers(
    q: str | None = Query(None, min_length=1),
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    filters = []
    if q and q.strip():
        keyword = f"%{q.strip()}%"
        filters.append(or_(DuesPayer.name.ilike(keyword), DuesPayer.student_number.ilike(keyword)))
    total = db.scalar(select(func.count(DuesPayer.id)).where(*filters)) or 0
    rows = db.execute(
        select(DuesPayer, Board.name)
        .outerjoin(Board, Board.id == DuesPayer.once_board_id)
        .where(*filters)
        .order_by(DuesPayer.name.asc(), DuesPayer.student_number.asc(), DuesPayer.id.asc())
        .offset((page - 1) * size)
        .limit(size)
    ).all()
    total_pages = (total + size - 1) // size if total else 0
    return success_response(
        [_admin_dues_payer_payload(item, board_name) for item, board_name in rows],
        pagination={"page": page, "size": size, "total": total, "total_pages": total_pages},
    )


@router.post("/admin/payers")
def create_admin_dues_payer(
    payload: DuesPayerWriteRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    item = DuesPayer(
        name=payload.name.strip(),
        major=payload.major.strip(),
        student_number=payload.student_number.upper(),
        is_full_paid=False,
        once_board_id=None,
    )
    board = apply_payment_scope(db, item, payload.payment_scope, payload.once_board_id)
    db.add(item)
    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        raise AppException(
            status_code=409,
            message="A dues payer with this student number already exists.",
            code="DUES_STUDENT_NUMBER_CONFLICT",
        ) from exc
    log_admin_action(
        db,
        actor_id=admin.id,
        action="dues_payer.create",
        target_type="dues_payer",
        target_id=item.id,
        details={
            "payer_id": item.id,
            "payment_scope": payment_scope(item),
            "once_board_id": item.once_board_id,
        },
    )
    _commit_individual_change(db)
    return success_response(_admin_dues_payer_payload(item, board.name if board else None))


@router.put("/admin/payers/{payer_id}")
def update_admin_dues_payer(
    payer_id: int,
    payload: DuesPayerWriteRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    item = db.scalar(select(DuesPayer).where(DuesPayer.id == payer_id).with_for_update())
    if item is None:
        raise AppException(
            status_code=404,
            message="Dues payer not found.",
            code="DUES_PAYER_NOT_FOUND",
        )

    item.name = payload.name.strip()
    item.major = payload.major.strip()
    item.student_number = payload.student_number.upper()
    board = apply_payment_scope(db, item, payload.payment_scope, payload.once_board_id)
    log_admin_action(
        db,
        actor_id=admin.id,
        action="dues_payer.update",
        target_type="dues_payer",
        target_id=item.id,
        details={
            "payer_id": item.id,
            "payment_scope": payment_scope(item),
            "once_board_id": item.once_board_id,
        },
    )
    _commit_individual_change(db)
    return success_response(_admin_dues_payer_payload(item, board.name if board else None))


@router.post("/admin/roster/import")
async def import_dues_payer_roster(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    rows = await _parse_workbook_upload(file)
    result = import_roster(db, rows)
    log_admin_action(
        db,
        actor_id=admin.id,
        action="dues_payer.roster_import",
        target_type="dues_payer",
        details=result,
    )
    db.commit()
    return success_response(result)


@router.post("/admin/import")
async def import_dues_payer_payments(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    rows = await _parse_workbook_upload(file)
    result = apply_full_payment_snapshot(db, rows)
    log_admin_action(
        db,
        actor_id=admin.id,
        action="dues_payer.payment_import",
        target_type="dues_payer",
        details=result,
    )
    db.commit()
    return success_response(result)


@router.post("/admin/delete-all")
def delete_all_dues_payers(
    payload: DuesPayerDeleteRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    if payload.confirmation != "진짜 삭제":
        raise AppException(
            status_code=400,
            message="Type 진짜 삭제 to permanently delete the dues payer roster.",
            code="DUES_DELETE_CONFIRMATION_REQUIRED",
        )
    deleted_count = db.scalar(select(func.count(DuesPayer.id))) or 0
    db.execute(delete(DuesPayer))
    log_admin_action(
        db,
        actor_id=admin.id,
        action="dues_payer.delete_all",
        target_type="dues_payer",
        details={"deleted": deleted_count},
    )
    db.commit()
    return success_response({"deleted": deleted_count})
