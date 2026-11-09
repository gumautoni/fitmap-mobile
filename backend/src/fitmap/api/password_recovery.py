"""Gated public password recovery with uniform issuance responses.

Never expose account existence, codes, or arbitrary client-supplied network identities.
Codes are encrypted in the transactional outbox; this module sends no emails.
"""

from binascii import Error as BinasciiError
from ipaddress import ip_address
from typing import Literal

from cryptography.fernet import Fernet
from fastapi import APIRouter, Request, Response, status
from pydantic import BaseModel

from fitmap.api.dependencies import DatabaseSessionDependency, SettingsDependency
from fitmap.api.errors import ApiError
from fitmap.config import Settings
from fitmap.identity.accounts import find_user_by_email
from fitmap.identity.email_issuance import queue_password_recovery
from fitmap.identity.password_recovery import ResetStatus, reset_password_with_code
from fitmap.identity.schemas import PasswordRecoveryRequest, PasswordRecoveryResetRequest
from fitmap.security.rate_limits import RateLimitAction, RateLimitDecision, consume_auth_rate_limit

router = APIRouter(prefix="/auth/password-recovery", tags=["auth"])


class RecoveryAccepted(BaseModel):
    status: Literal["accepted"]


class PasswordResetResult(BaseModel):
    status: Literal["reset"]


def _unavailable() -> ApiError:
    return ApiError(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        code="password_recovery_unavailable",
        message="Password recovery is not available.",
    )


def _feature_available(settings: Settings) -> None:
    """Disabled by default. Test-only enablement never sends email."""
    if not settings.auth_password_recovery_enabled:
        raise _unavailable()
    if (
        settings.auth_recovery_code_secret is None
        or settings.auth_rate_limit_secret is None
        or settings.email_outbox_encryption_key is None
        or len(settings.auth_recovery_code_secret.get_secret_value().encode()) < 32
        or len(settings.auth_rate_limit_secret.get_secret_value().encode()) < 32
    ):
        raise _unavailable()
    distinct_secrets = [
        settings.auth_jwt_secret.get_secret_value(),
        settings.auth_recovery_code_secret.get_secret_value(),
        settings.auth_rate_limit_secret.get_secret_value(),
        settings.email_outbox_encryption_key.get_secret_value(),
    ]
    if settings.auth_email_verification_secret is not None:
        distinct_secrets.append(settings.auth_email_verification_secret.get_secret_value())
    if len(set(distinct_secrets)) != len(distinct_secrets):
        raise _unavailable()
    try:
        Fernet(settings.email_outbox_encryption_key.get_secret_value().encode())
    except (ValueError, TypeError, BinasciiError):
        raise _unavailable() from None
    if settings.environment != "test" and (
        settings.email_provider != "resend"
        or settings.resend_api_key is None
        or settings.email_from_address is None
    ):
        raise _unavailable()


def _charge(
    *,
    request: Request,
    db_session: DatabaseSessionDependency,
    settings: Settings,
    action: RateLimitAction,
    email: str,
) -> RateLimitDecision:
    """Charge both IP and account-key buckets. Caller ALWAYS commits, even on denial.

    The configured ASGI proxy must supply a trusted client address. Never trust
    arbitrary X-Forwarded-For / X-Real-IP headers supplied by clients.
    """
    peer = request.client
    if peer is None:
        raise _unavailable()
    try:
        ip = str(ip_address(peer.host))
    except ValueError:
        raise _unavailable() from None
    return consume_auth_rate_limit(
        db_session=db_session,
        settings=settings,
        action=action,
        client_ip=ip,
        identifier=email,
    )


@router.post(
    "/request",
    status_code=status.HTTP_202_ACCEPTED,
    response_model=RecoveryAccepted,
)
def request_password_recovery(
    payload: PasswordRecoveryRequest,
    request: Request,
    response: Response,
    db_session: DatabaseSessionDependency,
    settings: SettingsDependency,
) -> RecoveryAccepted:
    """Uniform 202 for missing/ineligible/limited accounts; no token is returned."""
    _feature_available(settings)
    decision = _charge(
        request=request,
        db_session=db_session,
        settings=settings,
        action="password_recovery_request",
        email=str(payload.email),
    )
    if decision.allowed:
        account = find_user_by_email(db_session=db_session, email=str(payload.email))
        if account is not None:
            # The domain service will reject inactive/unverified/cooldown accounts.
            queue_password_recovery(
                db_session=db_session,
                user_id=account.id,
                settings=settings,
            )
    # Do NOT roll back a denied rate-limit event: accounts must be treated alike.
    db_session.commit()
    response.headers["Cache-Control"] = "no-store"
    return RecoveryAccepted(status="accepted")


@router.post("/reset", response_model=PasswordResetResult)
def reset_password(
    payload: PasswordRecoveryResetRequest,
    request: Request,
    response: Response,
    db_session: DatabaseSessionDependency,
    settings: SettingsDependency,
) -> PasswordResetResult:
    _feature_available(settings)
    decision = _charge(
        request=request,
        db_session=db_session,
        settings=settings,
        action="password_recovery_reset",
        email=str(payload.email),
    )
    if not decision.allowed:
        db_session.commit()
        raise ApiError(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            code="auth_rate_limited",
            message="Too many attempts. Try again later.",
        )
    outcome = reset_password_with_code(
        db_session=db_session,
        email=str(payload.email),
        code=payload.code,
        new_password=payload.password,
        settings=settings,
    )
    # Invalid comparisons still increment attempt counters and must be durable.
    db_session.commit()
    if outcome is ResetStatus.INVALID:
        raise ApiError(
            status_code=status.HTTP_400_BAD_REQUEST,
            code="invalid_recovery_code",
            message="Invalid or expired recovery code.",
        )
    response.headers["Cache-Control"] = "no-store"
    return PasswordResetResult(status="reset")
