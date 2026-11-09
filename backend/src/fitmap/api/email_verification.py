"""Authenticated verification endpoints; disabled until delivery is operational.

Never accept a user ID or email from the request. Do not trust forwarded IP headers.
The only active delivery path is the transactional encrypted outbox.
"""

from ipaddress import ip_address
from typing import Literal

from cryptography.fernet import Fernet
from fastapi import APIRouter, Request, Response, status
from pydantic import BaseModel, ConfigDict, Field

from fitmap.api.dependencies import (
    CurrentIdentityDependency,
    DatabaseSessionDependency,
    SettingsDependency,
)
from fitmap.api.errors import ApiError
from fitmap.config import Settings
from fitmap.identity.email_issuance import queue_email_verification
from fitmap.identity.email_verification import VerifyEmailStatus, confirm_email_verification
from fitmap.security.rate_limits import RateLimitAction, consume_auth_rate_limit

router = APIRouter(prefix="/auth/email-verification", tags=["auth"])


class ConfirmationPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: str = Field(min_length=6, max_length=6, pattern=r"^[0-9]{6}$")


class VerificationResult(BaseModel):
    status: Literal["accepted", "verified", "already_verified"]


def _feature_available(settings: Settings) -> None:
    """Fail closed; test-only enabling must not activate real delivery."""
    if not settings.auth_email_verification_enabled:
        raise _unavailable()
    if (
        settings.auth_email_verification_secret is None
        or settings.auth_rate_limit_secret is None
        or settings.email_outbox_encryption_key is None
        or len(settings.auth_email_verification_secret.get_secret_value().encode()) < 32
        or len(settings.auth_rate_limit_secret.get_secret_value().encode()) < 32
    ):
        raise _unavailable()
    try:
        Fernet(settings.email_outbox_encryption_key.get_secret_value().encode())
    except (ValueError, TypeError):
        raise _unavailable() from None
    if settings.environment != "test" and (
        settings.email_provider != "resend"
        or settings.resend_api_key is None
        or settings.email_from_address is None
    ):
        raise _unavailable()


def _unavailable() -> ApiError:
    return ApiError(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        code="email_verification_unavailable",
        message="Email verification is not available.",
    )


def _charge(
    *,
    request: Request,
    db_session: DatabaseSessionDependency,
    settings: Settings,
    action: RateLimitAction,
    user_id: str,
) -> None:
    """Commit throttling events even when denying the request."""
    peer = request.client
    if peer is None:
        raise _unavailable()
    try:
        ip = str(ip_address(peer.host))
    except ValueError:
        # No fallback to X-Forwarded-For: must be a trustworthy ASGI peer.
        raise _unavailable() from None
    decision = consume_auth_rate_limit(
        db_session=db_session,
        settings=settings,
        action=action,
        client_ip=ip,
        identifier=user_id,
    )
    if not decision.allowed:
        db_session.commit()
        raise ApiError(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            code="auth_rate_limited",
            message="Too many attempts. Try again later.",
        )


@router.post(
    "/request",
    response_model=VerificationResult,
    status_code=status.HTTP_202_ACCEPTED,
)
def request_email_verification(
    request: Request,
    response: Response,
    identity: CurrentIdentityDependency,
    db_session: DatabaseSessionDependency,
    settings: SettingsDependency,
) -> VerificationResult:
    _feature_available(settings)
    _charge(
        request=request,
        db_session=db_session,
        settings=settings,
        action="email_verification_issue",
        user_id=str(identity.user.id),
    )
    # Cooldown, already-verified and newly-queued all share the same safe response.
    queue_email_verification(
        db_session=db_session,
        authenticated_user_id=identity.user.id,
        settings=settings,
    )
    db_session.commit()
    response.headers["Cache-Control"] = "no-store"
    return VerificationResult(status="accepted")


@router.post("/confirm", response_model=VerificationResult)
def confirm_email_verification_code(
    payload: ConfirmationPayload,
    request: Request,
    response: Response,
    identity: CurrentIdentityDependency,
    db_session: DatabaseSessionDependency,
    settings: SettingsDependency,
) -> VerificationResult:
    _feature_available(settings)
    _charge(
        request=request,
        db_session=db_session,
        settings=settings,
        action="email_verification_confirm",
        user_id=str(identity.user.id),
    )
    outcome = confirm_email_verification(
        db_session=db_session,
        authenticated_user_id=identity.user.id,
        code=payload.code,
        settings=settings,
    )
    # A failed comparison increments persisted challenge attempts: never roll it back.
    db_session.commit()
    if outcome is VerifyEmailStatus.INVALID:
        raise ApiError(
            status_code=status.HTTP_400_BAD_REQUEST,
            code="invalid_verification_code",
            message="Invalid or expired verification code.",
        )
    response.headers["Cache-Control"] = "no-store"
    if outcome is VerifyEmailStatus.ALREADY_VERIFIED:
        return VerificationResult(status="already_verified")
    return VerificationResult(status="verified")
