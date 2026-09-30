from fastapi import APIRouter, Depends
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.audit import log_admin_action
from app.deps import get_db, require_admin
from app.errors import AppException
from app.models.registration import MajorOption, PrivacyPolicyVersion
from app.models.user import User
from app.response import success_response
from app.schemas.registration import MajorOptionCreate, MajorOptionUpdate, PrivacyPolicyUpdate
from app.security import utc_now

router = APIRouter()


def _major_payload(item: MajorOption) -> dict:
    return {
        "id": item.id,
        "name": item.name,
        "sort_order": item.sort_order,
        "is_active": item.is_active,
        "created_at": item.created_at,
        "updated_at": item.updated_at,
    }


def _policy_payload(item: PrivacyPolicyVersion) -> dict:
    return {
        "id": item.id,
        "version": item.version,
        "effective_at": item.effective_at,
        "is_active": item.is_active,
        "updated_at": item.updated_at,
    }


def _active_policy(db: Session) -> PrivacyPolicyVersion:
    policy = db.scalar(
        select(PrivacyPolicyVersion)
        .where(PrivacyPolicyVersion.is_active.is_(True))
        .order_by(PrivacyPolicyVersion.effective_at.desc(), PrivacyPolicyVersion.id.desc())
        .limit(1)
    )
    if policy is None:
        raise AppException(status_code=503, message="Privacy policy is not configured.", code="SERVICE_UNAVAILABLE")
    return policy


@router.get("/options")
def get_registration_options(db: Session = Depends(get_db)):
    majors = db.scalars(
        select(MajorOption)
        .where(MajorOption.is_active.is_(True))
        .order_by(MajorOption.sort_order.asc(), MajorOption.id.asc())
    ).all()
    return success_response(
        {
            "majors": [_major_payload(item) for item in majors],
            "privacy_policy": _policy_payload(_active_policy(db)),
        }
    )


@router.get("/admin/majors")
def get_admin_majors(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    majors = db.scalars(select(MajorOption).order_by(MajorOption.sort_order.asc(), MajorOption.id.asc())).all()
    return success_response([_major_payload(item) for item in majors])


@router.post("/admin/majors")
def create_major(payload: MajorOptionCreate, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    name = payload.name.strip()
    duplicate = db.scalar(select(MajorOption.id).where(func.lower(MajorOption.name) == name.lower()))
    if duplicate is not None:
        raise AppException(status_code=409, message="Major option already exists.", code="CONFLICT")
    item = MajorOption(name=name, sort_order=payload.sort_order, is_active=True)
    db.add(item)
    db.flush()
    log_admin_action(
        db,
        actor_id=admin.id,
        action="registration.major.create",
        target_type="major_option",
        target_id=item.id,
        details={"name": name, "sort_order": item.sort_order},
    )
    db.commit()
    db.refresh(item)
    return success_response(_major_payload(item))


@router.put("/admin/majors/{major_id}")
def update_major(
    major_id: int,
    payload: MajorOptionUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    item = db.get(MajorOption, major_id)
    if item is None:
        raise AppException(status_code=404, message="Major option not found.", code="NOT_FOUND")
    name = payload.name.strip()
    duplicate = db.scalar(
        select(MajorOption.id).where(func.lower(MajorOption.name) == name.lower(), MajorOption.id != major_id)
    )
    if duplicate is not None:
        raise AppException(status_code=409, message="Major option already exists.", code="CONFLICT")
    if item.is_active and not payload.is_active:
        active_count = int(
            db.scalar(select(func.count(MajorOption.id)).where(MajorOption.is_active.is_(True))) or 0
        )
        if active_count <= 1:
            raise AppException(
                status_code=400,
                message="At least one active major option is required.",
                code="MAJOR_OPTION_REQUIRED",
            )
    before = {"name": item.name, "sort_order": item.sort_order, "is_active": item.is_active}
    item.name = name
    item.sort_order = payload.sort_order
    item.is_active = payload.is_active
    log_admin_action(
        db,
        actor_id=admin.id,
        action="registration.major.update",
        target_type="major_option",
        target_id=item.id,
        details={"before": before, "after": {"name": name, "sort_order": item.sort_order, "is_active": item.is_active}},
    )
    db.commit()
    db.refresh(item)
    return success_response(_major_payload(item))


@router.get("/admin/privacy-policy")
def get_admin_privacy_policy(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    return success_response(_policy_payload(_active_policy(db)))


@router.put("/admin/privacy-policy")
def update_privacy_policy(
    payload: PrivacyPolicyUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    version = payload.version.strip()
    current = db.scalar(select(PrivacyPolicyVersion).where(PrivacyPolicyVersion.is_active.is_(True)).limit(1))
    target = db.scalar(select(PrivacyPolicyVersion).where(PrivacyPolicyVersion.version == version))

    db.execute(
        update(PrivacyPolicyVersion)
        .where(PrivacyPolicyVersion.is_active.is_(True))
        .values(is_active=False, updated_at=utc_now())
    )
    db.flush()
    if target is None:
        target = PrivacyPolicyVersion(
            version=version,
            effective_at=payload.effective_at,
            is_active=True,
            created_by=admin.id,
        )
        db.add(target)
    else:
        target.effective_at = payload.effective_at
        target.is_active = True
        target.updated_at = utc_now()
    db.flush()
    log_admin_action(
        db,
        actor_id=admin.id,
        action="registration.privacy_policy.activate",
        target_type="privacy_policy_version",
        target_id=target.id,
        details={"before": current.version if current else None, "after": version, "effective_at": payload.effective_at.isoformat()},
    )
    db.commit()
    db.refresh(target)
    return success_response(_policy_payload(target))
