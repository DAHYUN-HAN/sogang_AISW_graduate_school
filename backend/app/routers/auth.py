import logging
from datetime import timedelta
from math import ceil

from fastapi import APIRouter, Depends, Request
from sqlalchemy import delete, select, text
from sqlalchemy.orm import Session

from app.account_deletion import ACCOUNT_DELETE_PURPOSE, delete_user_account
from app.config import settings
from app.deps import get_current_user, get_db
from app.email import is_email_configured, send_email
from app.email_templates import account_deletion_email, password_reset_email, verification_email
from app.errors import AppException
from app.models.auth import EmailVerificationToken, PasswordResetToken, RefreshToken
from app.models.notification import NotificationSetting
from app.models.registration import MajorOption, PrivacyPolicyVersion
from app.models.user import User
from app.response import success_response
from app.rate_limit import enforce_rate_limit
from app.schemas.auth import (
    AccountDeletionRequest,
    AccountDeletionVerify,
    EmailVerificationConfirm,
    EmailVerificationRequest,
    LoginRequest,
    LogoutRequest,
    PasswordResetConfirm,
    PasswordResetRequest,
    PasswordResetVerify,
    RefreshRequest,
    RegisterRequest,
)
from app.security import (
    create_access_token,
    ensure_password_policy,
    ensure_school_email,
    generate_token_urlsafe,
    generate_verification_code,
    hash_password,
    hash_token,
    hash_verification_code,
    password_needs_rehash,
    utc_now,
    verify_password,
    verify_verification_code,
)
from app.user_validation import normalize_nickname

router = APIRouter()
logger = logging.getLogger(__name__)
MAX_VERIFICATION_ATTEMPTS = 5


def _verification_failure(token, db: Session, *, expired_code: str, invalid_code: str) -> None:
    if token is None:
        raise AppException(status_code=400, message="Invalid verification code.", code=invalid_code)
    if token.expires_at < utc_now():
        raise AppException(status_code=400, message="Verification code expired.", code=expired_code)
    if token.attempt_count >= MAX_VERIFICATION_ATTEMPTS:
        raise AppException(
            status_code=429,
            message="Verification attempt limit exceeded.",
            code="VERIFICATION_ATTEMPTS_EXCEEDED",
        )
    token.attempt_count += 1
    db.commit()
    if token.attempt_count >= MAX_VERIFICATION_ATTEMPTS:
        raise AppException(
            status_code=429,
            message="Verification attempt limit exceeded.",
            code="VERIFICATION_ATTEMPTS_EXCEEDED",
        )
    raise AppException(status_code=400, message="Invalid verification code.", code=invalid_code)


def _lock_email_request(db: Session, email: str) -> None:
    bind = db.get_bind()
    if bind.dialect.name == "postgresql":
        db.execute(text("SELECT pg_advisory_xact_lock(hashtextextended(:email, 0))"), {"email": email})


def _account_deletion_invalid() -> AppException:
    return AppException(
        status_code=400,
        message="Invalid or expired account deletion request.",
        code="ACCOUNT_DELETION_INVALID",
    )


def _user_payload(user: User) -> dict:
    return {
        "id": user.id,
        "email": user.email,
        "nickname": user.nickname,
        "cohort": user.cohort,
        "role": user.role,
    }


def _issue_tokens(db: Session, user: User) -> dict:
    refresh_token = generate_token_urlsafe()
    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=hash_token(refresh_token),
            expires_at=utc_now() + timedelta(days=settings.refresh_token_expire_days),
        )
    )
    user.last_login_at = utc_now()
    db.commit()

    return {
        "access_token": create_access_token(user.id, user.role),
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "expires_in": settings.access_token_expire_minutes * 60,
        "user": _user_payload(user),
    }


@router.post("/login")
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    enforce_rate_limit(request, action="auth.login", subject=payload.email, limit=8, ip_limit=30, window_seconds=300)
    user = db.scalar(select(User).where(User.email == payload.email.lower()).with_for_update().execution_options(populate_existing=True))
    if user is None or not verify_password(payload.password, user.password_hash):
        raise AppException(status_code=401, message="Invalid email or password.", code="UNAUTHORIZED")
    if not user.is_active:
        raise AppException(status_code=403, message="Inactive account.", code="FORBIDDEN")

    if password_needs_rehash(user.password_hash):
        user.password_hash = hash_password(payload.password)

    return success_response(_issue_tokens(db, user))


@router.post("/register/request-verification")
def request_register_verification(payload: EmailVerificationRequest, request: Request, db: Session = Depends(get_db)):
    email = payload.email.lower()
    enforce_rate_limit(request, action="auth.register.request", subject=email, limit=3, ip_limit=10, window_seconds=900)
    ensure_school_email(email)

    existing_user = db.scalar(select(User.id).where(User.email == email))
    if existing_user is not None:
        raise AppException(status_code=409, message="Email already registered.", code="CONFLICT")

    # Serialize requests for the same address so concurrent calls cannot issue multiple codes.
    _lock_email_request(db, email)

    previous_tokens = db.scalars(
        select(EmailVerificationToken).where(
            EmailVerificationToken.email == email,
            EmailVerificationToken.purpose == "register",
            EmailVerificationToken.consumed_at.is_(None),
        ).order_by(EmailVerificationToken.created_at.desc(), EmailVerificationToken.id.desc())
    ).all()

    now = utc_now()
    latest_token = previous_tokens[0] if previous_tokens else None
    if latest_token is not None:
        elapsed_seconds = (now - latest_token.created_at).total_seconds()
        if elapsed_seconds < settings.email_verification_resend_cooldown_seconds:
            retry_after = max(
                1,
                ceil(settings.email_verification_resend_cooldown_seconds - elapsed_seconds),
            )
            raise AppException(
                status_code=429,
                message="Verification code can be requested again after the cooldown.",
                code="VERIFICATION_RESEND_COOLDOWN",
                headers={"Retry-After": str(retry_after)},
            )

    code = generate_verification_code()
    token = EmailVerificationToken(
        email=email,
        code_hash=hash_verification_code(code, email=email, purpose="register"),
        purpose="register",
        expires_at=now + timedelta(minutes=settings.email_verification_expire_minutes),
    )
    db.add(token)
    db.commit()

    data = {
        "email": email,
        "expires_in": settings.email_verification_expire_minutes * 60,
        "resend_in": settings.email_verification_resend_cooldown_seconds,
    }
    if not is_email_configured():
        logger.warning("Registration verification email was not sent because SMTP is not configured")
        db.delete(token)
        db.commit()
        data["email_sent"] = False
        data["dev_mode"] = False
        return success_response(data)

    plain_body, html_body = verification_email(
        code,
        settings.email_verification_expire_minutes,
        contact_email=settings.support_email,
    )
    try:
        email_sent = send_email(
            email,
            "[AI·SW CAMPUS] 요청하신 이메일 확인 코드",
            plain_body,
            html_body=html_body,
        )
    except Exception as exc:
        db.delete(token)
        db.commit()
        raise AppException(
            status_code=503,
            message="Verification email delivery is temporarily unavailable.",
            code="EMAIL_DELIVERY_UNAVAILABLE",
        ) from exc

    if not email_sent:
        db.delete(token)
        db.commit()
        data["email_sent"] = False
        return success_response(data)

    consumed_at = utc_now()
    for previous in previous_tokens:
        previous.consumed_at = consumed_at
    db.commit()
    data["email_sent"] = email_sent
    return success_response(data)


@router.post("/register/verify-email")
def verify_register_email(payload: EmailVerificationConfirm, request: Request, db: Session = Depends(get_db)):
    email = payload.email.lower()
    enforce_rate_limit(request, action="auth.register.verify", subject=email, limit=10, ip_limit=30, window_seconds=900)
    token = db.scalar(
        select(EmailVerificationToken)
        .where(
            EmailVerificationToken.email == email,
            EmailVerificationToken.purpose == "register",
            EmailVerificationToken.consumed_at.is_(None),
        )
        .order_by(EmailVerificationToken.created_at.desc(), EmailVerificationToken.id.desc())
        .limit(1)
        .with_for_update()
    )
    if token is None:
        _verification_failure(
            token,
            db,
            expired_code="VERIFICATION_EXPIRED",
            invalid_code="VERIFICATION_CODE_INVALID",
        )
    if token.expires_at < utc_now():
        raise AppException(status_code=400, message="Verification code expired.", code="VERIFICATION_EXPIRED")
    if token.attempt_count >= MAX_VERIFICATION_ATTEMPTS:
        _verification_failure(
            token,
            db,
            expired_code="VERIFICATION_EXPIRED",
            invalid_code="VERIFICATION_CODE_INVALID",
        )
    if not verify_verification_code(
        payload.code,
        token.code_hash,
        email=email,
        purpose="register",
    ):
        _verification_failure(
            token,
            db,
            expired_code="VERIFICATION_EXPIRED",
            invalid_code="VERIFICATION_CODE_INVALID",
        )

    verification_token = generate_token_urlsafe()
    token.code_hash = hash_token(verification_token)
    token.consumed_at = utc_now()
    token.expires_at = utc_now() + timedelta(minutes=15)
    db.commit()

    return success_response({"verification_token": verification_token, "expires_in": 15 * 60})


@router.post("/register")
def register(payload: RegisterRequest, request: Request, db: Session = Depends(get_db)):
    enforce_rate_limit(request, action="auth.register", limit=10, window_seconds=3600)
    ensure_password_policy(payload.password)
    nickname = normalize_nickname(payload.nickname)
    if not nickname:
        raise AppException(status_code=422, message="Nickname is required.", code="VALIDATION_ERROR")
    if not payload.privacy_consent:
        raise AppException(status_code=400, message="Privacy consent is required.", code="PRIVACY_CONSENT_REQUIRED")
    active_policy = db.scalar(
        select(PrivacyPolicyVersion)
        .where(PrivacyPolicyVersion.is_active.is_(True))
        .order_by(PrivacyPolicyVersion.effective_at.desc(), PrivacyPolicyVersion.id.desc())
        .limit(1)
    )
    if active_policy is None:
        raise AppException(status_code=503, message="Privacy policy is not configured.", code="SERVICE_UNAVAILABLE")
    if payload.privacy_policy_version != active_policy.version:
        raise AppException(
            status_code=409,
            message="Privacy policy version changed. Consent is required again.",
            code="PRIVACY_POLICY_VERSION_MISMATCH",
        )
    major_exists = db.scalar(
        select(MajorOption.id).where(MajorOption.name == payload.major, MajorOption.is_active.is_(True))
    )
    if major_exists is None:
        raise AppException(status_code=422, message="Active major option is required.", code="VALIDATION_ERROR")

    verification_token_hash = hash_token(payload.verification_token)
    claimed_verification = db.execute(
        delete(EmailVerificationToken).where(
            EmailVerificationToken.code_hash == verification_token_hash,
            EmailVerificationToken.purpose == "register",
            EmailVerificationToken.consumed_at.is_not(None),
            EmailVerificationToken.expires_at >= utc_now(),
        )
        .returning(EmailVerificationToken.email)
    ).first()
    if claimed_verification is None:
        raise AppException(status_code=400, message="Invalid verification token.", code="BAD_REQUEST")

    verified_email = claimed_verification.email
    existing_user = db.scalar(select(User.id).where(User.email == verified_email))
    if existing_user is not None:
        raise AppException(status_code=409, message="Email already registered.", code="CONFLICT")

    user = User(
        username=verified_email,
        password_hash=hash_password(payload.password),
        nickname=nickname,
        cohort=payload.cohort,
        major=payload.major,
        phone=payload.phone,
        company=payload.company,
        job_title=payload.job_title,
        position=payload.position,
        email=verified_email,
        privacy_policy_version=active_policy.version,
        privacy_consented_at=utc_now(),
        role="user",
    )
    db.add(user)
    db.flush()
    db.add(NotificationSetting(user_id=user.id))
    return success_response(_issue_tokens(db, user))


@router.post("/refresh")
def refresh(payload: RefreshRequest, request: Request, db: Session = Depends(get_db)):
    enforce_rate_limit(request, action="auth.refresh", subject=payload.refresh_token, limit=10, ip_limit=60, window_seconds=300)
    token_hash = hash_token(payload.refresh_token)
    refresh_token = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == token_hash))
    if refresh_token is None:
        raise AppException(status_code=401, message="Invalid refresh token.", code="UNAUTHORIZED")

    # Serialize credential changes and session issuance on the same user row.
    # Reload the token after waiting: the identity map may hold a revoked token.
    user = db.scalar(select(User).where(User.id == refresh_token.user_id).with_for_update().execution_options(populate_existing=True))
    refresh_token = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == token_hash).execution_options(populate_existing=True))
    if refresh_token is None or refresh_token.revoked_at is not None or refresh_token.expires_at < utc_now():
        raise AppException(status_code=401, message="Invalid refresh token.", code="UNAUTHORIZED")
    if user is None or not user.is_active:
        raise AppException(status_code=401, message="Invalid refresh token.", code="UNAUTHORIZED")

    refresh_token.revoked_at = utc_now()
    return success_response(_issue_tokens(db, user))


@router.post("/logout")
def logout(payload: LogoutRequest, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    refresh_token = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == hash_token(payload.refresh_token)))
    if refresh_token is not None and refresh_token.revoked_at is None:
        refresh_token.revoked_at = utc_now()
        db.commit()

    return success_response({"logged_out": True})


@router.post("/account-deletion/request")
def request_account_deletion(
    payload: AccountDeletionRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """Issue a deletion code without revealing whether the account exists."""

    email = payload.email.lower()
    enforce_rate_limit(
        request,
        action="auth.account_deletion.request",
        subject=email,
        limit=3,
        ip_limit=10,
        window_seconds=900,
    )
    ensure_school_email(email)
    response_data = {
        "accepted": True,
        "expires_in": settings.email_verification_expire_minutes * 60,
        "resend_in": settings.email_verification_resend_cooldown_seconds,
    }

    _lock_email_request(db, email)
    user = db.scalar(select(User).where(User.email == email))
    if user is None:
        return success_response(response_data)

    previous_tokens = db.scalars(
        select(EmailVerificationToken)
        .where(
            EmailVerificationToken.email == email,
            EmailVerificationToken.purpose == ACCOUNT_DELETE_PURPOSE,
            EmailVerificationToken.consumed_at.is_(None),
        )
        .order_by(EmailVerificationToken.created_at.desc(), EmailVerificationToken.id.desc())
    ).all()
    now = utc_now()
    latest_token = previous_tokens[0] if previous_tokens else None
    if (
        latest_token is not None
        and (now - latest_token.created_at).total_seconds()
        < settings.email_verification_resend_cooldown_seconds
    ):
        return success_response(response_data)

    code = generate_verification_code()
    token = EmailVerificationToken(
        email=email,
        code_hash=hash_token(code),
        purpose=ACCOUNT_DELETE_PURPOSE,
        expires_at=now + timedelta(minutes=settings.email_verification_expire_minutes),
    )
    db.add(token)
    db.commit()

    delivered = False
    if not is_email_configured():
        logger.warning("Account deletion verification email was not sent because SMTP is not configured")
    else:
        plain_body, html_body = account_deletion_email(
            code,
            settings.email_verification_expire_minutes,
            contact_email=settings.support_email,
        )
        try:
            delivered = send_email(
                email,
                "[AI·SW CAMPUS] 요청하신 계정 삭제 확인 코드",
                plain_body,
                html_body=html_body,
            )
        except Exception:
            # Delivery failures must not turn this endpoint into an account
            # existence oracle.
            logger.exception("Failed to send account deletion verification email")

    if not delivered:
        db.delete(token)
        db.commit()
        return success_response(response_data)

    consumed_at = utc_now()
    for previous in previous_tokens:
        previous.consumed_at = consumed_at
    db.commit()
    return success_response(response_data)


@router.post("/account-deletion/verify")
def verify_account_deletion(
    payload: AccountDeletionVerify,
    request: Request,
    db: Session = Depends(get_db),
):
    """Verify email ownership and password, then permanently delete the account."""

    email = payload.email.lower()
    enforce_rate_limit(
        request,
        action="auth.account_deletion.verify",
        subject=email,
        limit=10,
        ip_limit=30,
        window_seconds=900,
    )
    ensure_school_email(email)
    token = db.scalar(
        select(EmailVerificationToken)
        .where(
            EmailVerificationToken.email == email,
            EmailVerificationToken.purpose == ACCOUNT_DELETE_PURPOSE,
            EmailVerificationToken.consumed_at.is_(None),
        )
        .order_by(EmailVerificationToken.created_at.desc(), EmailVerificationToken.id.desc())
        .limit(1)
        .with_for_update()
    )
    user = db.scalar(select(User).where(User.email == email))
    valid = bool(
        token is not None
        and user is not None
        and token.expires_at >= utc_now()
        and token.attempt_count < MAX_VERIFICATION_ATTEMPTS
        and token.code_hash == hash_token(payload.code)
        and verify_password(payload.current_password, user.password_hash)
    )
    if not valid:
        if token is not None and token.expires_at >= utc_now():
            token.attempt_count = min(MAX_VERIFICATION_ATTEMPTS, token.attempt_count + 1)
            db.commit()
        raise _account_deletion_invalid()

    try:
        result = delete_user_account(
            db,
            user_id=user.id,
            current_password=payload.current_password,
            channel="public_email",
        )
    except AppException as exc:
        if exc.code == "ADMIN_ACCOUNT_DELETION_FORBIDDEN":
            raise
        raise _account_deletion_invalid() from exc
    return success_response(
        {
            "deleted": True,
            "receipt_id": result.receipt_id,
            "completed_at": result.completed_at,
        }
    )


@router.post("/password-reset/request")
def request_password_reset(payload: PasswordResetRequest, request: Request, db: Session = Depends(get_db)):
    email = payload.email.lower()
    enforce_rate_limit(request, action="auth.password_reset.request", subject=email, limit=3, ip_limit=10, window_seconds=900)
    ensure_school_email(email)

    data = {
        "accepted": True,
        "expires_in": settings.password_reset_expire_minutes * 60,
        "resend_in": settings.password_reset_resend_cooldown_seconds,
    }

    # Serialize reset requests by address so concurrent requests cannot issue
    # multiple valid codes. The same key is used even for unknown addresses to
    # keep request behavior independent from account existence.
    db.execute(text("SELECT pg_advisory_xact_lock(hashtextextended(:email, 0))"), {"email": email})
    user = db.scalar(select(User).where(User.email == email))
    if user is not None and user.is_active:
        previous_tokens = db.scalars(
            select(PasswordResetToken).where(
                PasswordResetToken.user_id == user.id,
                PasswordResetToken.consumed_at.is_(None),
            ).order_by(PasswordResetToken.created_at.desc(), PasswordResetToken.id.desc())
        ).all()

        now = utc_now()
        latest_token = previous_tokens[0] if previous_tokens else None
        if latest_token is not None:
            elapsed_seconds = (now - latest_token.created_at).total_seconds()
            if elapsed_seconds < settings.password_reset_resend_cooldown_seconds:
                # Keep the response indistinguishable from an unknown account.
                # The frontend prevents ordinary users from retrying before the
                # cooldown, while the backend simply refuses to issue a new code.
                # 개발(SMTP 미설정)에서는 직전 코드가 아직 유효하므로 흐름을 진행시킨다.
                data["email_sent"] = True if not is_email_configured() else is_email_configured()
                return success_response(data)

        reset_token = generate_verification_code()
        token = PasswordResetToken(
            user_id=user.id,
            token_hash=hash_token(reset_token),
            expires_at=now + timedelta(minutes=settings.password_reset_expire_minutes),
        )
        db.add(token)
        db.commit()

        if not is_email_configured():
            logger.warning("Password reset email was not sent because SMTP is not configured")
            db.delete(token)
            db.commit()
            data["email_sent"] = False
            data["dev_mode"] = False
            return success_response(data)

        plain_body, html_body = password_reset_email(
            reset_token,
            settings.password_reset_expire_minutes,
            contact_email=settings.support_email,
        )
        try:
            email_sent = send_email(
                user.email,
                "[AI·SW CAMPUS] 비밀번호 재설정 인증 코드",
                plain_body,
                html_body=html_body,
            )
        except Exception:
            db.delete(token)
            db.commit()
            raise

        if not email_sent:
            db.delete(token)
            db.commit()
            data["email_sent"] = False
            return success_response(data)

        consumed_at = utc_now()
        for previous in previous_tokens:
            previous.consumed_at = consumed_at
        db.commit()
        data["email_sent"] = email_sent
    else:
        data["email_sent"] = is_email_configured()
    return success_response(data)


@router.post("/password-reset/verify-code")
def verify_password_reset_code(payload: PasswordResetVerify, request: Request, db: Session = Depends(get_db)):
    email = payload.email.lower()
    enforce_rate_limit(request, action="auth.password_reset.verify", subject=email, limit=10, ip_limit=30, window_seconds=900)
    ensure_school_email(email)
    user = db.scalar(select(User).where(User.email == email, User.is_active.is_(True)))
    token = None
    if user is not None:
        token = db.scalar(
            select(PasswordResetToken)
            .where(
                PasswordResetToken.user_id == user.id,
                PasswordResetToken.consumed_at.is_(None),
                PasswordResetToken.verified_at.is_(None),
            )
            .order_by(PasswordResetToken.created_at.desc(), PasswordResetToken.id.desc())
            .limit(1)
        )

    if token is None or token.expires_at < utc_now() or token.token_hash != hash_token(payload.code):
        if token is not None and token.token_hash == hash_token(payload.code):
            raise AppException(status_code=400, message="Verification code expired.", code="VERIFICATION_EXPIRED")
        _verification_failure(
            token,
            db,
            expired_code="VERIFICATION_EXPIRED",
            invalid_code="VERIFICATION_CODE_INVALID",
        )

    verification_token = generate_token_urlsafe()
    token.token_hash = hash_token(verification_token)
    token.verified_at = utc_now()
    token.expires_at = utc_now() + timedelta(minutes=15)
    db.commit()
    return success_response({"verification_token": verification_token, "expires_in": 15 * 60})


@router.post("/password-reset/confirm")
def confirm_password_reset(payload: PasswordResetConfirm, request: Request, db: Session = Depends(get_db)):
    enforce_rate_limit(request, action="auth.password_reset.confirm", subject=payload.token, limit=5, ip_limit=15, window_seconds=900)
    ensure_password_policy(payload.new_password)
    reset_token = db.scalar(select(PasswordResetToken).where(PasswordResetToken.token_hash == hash_token(payload.token)))
    if reset_token is None:
        raise AppException(status_code=400, message="Invalid or expired reset token.", code="BAD_REQUEST")
    user = db.scalar(select(User).where(User.id == reset_token.user_id).with_for_update().execution_options(populate_existing=True))
    reset_token = db.scalar(
        select(PasswordResetToken).where(PasswordResetToken.token_hash == hash_token(payload.token)).execution_options(populate_existing=True)
    )
    if (
        reset_token is None
        or reset_token.consumed_at is not None
        or reset_token.verified_at is None
        or reset_token.expires_at < utc_now()
    ):
        raise AppException(status_code=400, message="Invalid or expired reset token.", code="BAD_REQUEST")

    if user is None or not user.is_active:
        raise AppException(status_code=400, message="Invalid or expired reset token.", code="BAD_REQUEST")

    user.password_hash = hash_password(payload.new_password)
    reset_token.consumed_at = utc_now()
    active_refresh_tokens = db.scalars(
        select(RefreshToken).where(
            RefreshToken.user_id == user.id,
            RefreshToken.revoked_at.is_(None),
        )
    ).all()
    for refresh_token in active_refresh_tokens:
        refresh_token.revoked_at = utc_now()
    db.commit()

    return success_response({"changed": True})
