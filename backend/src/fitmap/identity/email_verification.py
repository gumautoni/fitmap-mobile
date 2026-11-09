"""Internal proof-of-email-ownership workflow; no public routes or provider here.

The authenticated caller MUST derive user_id from a verified session. The issue
operation only persists a challenge in the caller's transaction and returns secret
material to a trusted orchestrator. Commit durably before any provider delivery.
A production sender/outbox and abuse controls are prerequisites for HTTP exposure.
"""

import hmac
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from enum import StrEnum
from hashlib import sha256
from uuid import UUID, uuid4

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from fitmap.config import Settings
from fitmap.identity.models import User
from fitmap.identity.verification_models import EmailVerificationChallenge

CODE_LIFETIME = timedelta(minutes=10)
SEND_COOLDOWN = timedelta(seconds=60)
SEND_WINDOW = timedelta(hours=1)
MAX_SENDS_PER_HOUR = 3
MAX_ATTEMPTS = 5


class IssueVerificationStatus(StrEnum):
    ISSUED = "issued"
    INELIGIBLE = "ineligible"
    RATE_LIMITED = "rate_limited"


class VerifyEmailStatus(StrEnum):
    VERIFIED = "verified"
    ALREADY_VERIFIED = "already_verified"
    INVALID = "invalid"


@dataclass(frozen=True, slots=True, repr=False)
class VerificationCodeMaterial:
    """Ephemeral secret. Do not serialize, log or return in an HTTP response."""

    recipient: str
    code: str
    expires_at: datetime


@dataclass(frozen=True, slots=True, repr=False)
class IssueVerificationResult:
    status: IssueVerificationStatus
    material: VerificationCodeMaterial | None = None


def _key(settings: Settings) -> bytes:
    configured = settings.auth_email_verification_secret
    if configured is None or len(configured.get_secret_value().encode("utf-8")) < 32:
        raise RuntimeError("A separate email-verification secret (32+ bytes) is required.")
    secret = configured.get_secret_value()
    if secret == settings.auth_jwt_secret.get_secret_value():
        raise RuntimeError("Email-verification and JWT secrets must be distinct.")
    recovery = settings.auth_recovery_code_secret
    if recovery is not None and secret == recovery.get_secret_value():
        raise RuntimeError("Email-verification and recovery secrets must be distinct.")
    return secret.encode("utf-8")


def hash_email_verification_code(*, challenge_id: UUID, code: str, settings: Settings) -> str:
    """HMAC-domain-separate short codes from recovery and other workflows."""
    message = f"fitmap-email-verification:{challenge_id}:{code}".encode()
    return hmac.new(_key(settings), message, sha256).hexdigest()


def _now(value: datetime | None) -> datetime:
    current = value if value is not None else datetime.now(UTC)
    if current.tzinfo is None or current.utcoffset() is None:
        raise ValueError("Email-verification timestamps must be timezone-aware.")
    return current


def issue_email_verification(
    *,
    db_session: Session,
    authenticated_user_id: UUID,
    settings: Settings,
    now: datetime | None = None,
) -> IssueVerificationResult:
    """Persist a code WITHOUT sending. Caller commits before transport delivery.

    A trusted application boundary must supply authenticated_user_id, never an
    arbitrary user_id from client input. Do not expose this function directly.
    """
    current = _now(now)
    _key(settings)
    user = db_session.scalar(select(User).where(User.id == authenticated_user_id).with_for_update())
    if user is None or not user.is_active or user.email_verified_at is not None:
        return IssueVerificationResult(IssueVerificationStatus.INELIGIBLE)

    recent = db_session.scalars(
        select(EmailVerificationChallenge)
        .where(
            EmailVerificationChallenge.user_id == user.id,
            EmailVerificationChallenge.created_at >= current - SEND_WINDOW,
        )
        .order_by(EmailVerificationChallenge.created_at.desc())
    ).all()
    if len(recent) >= MAX_SENDS_PER_HOUR:
        return IssueVerificationResult(IssueVerificationStatus.RATE_LIMITED)
    if recent and recent[0].created_at > current - SEND_COOLDOWN:
        return IssueVerificationResult(IssueVerificationStatus.RATE_LIMITED)

    code = f"{secrets.randbelow(1_000_000):06d}"
    challenge_id = uuid4()
    db_session.execute(
        update(EmailVerificationChallenge)
        .where(
            EmailVerificationChallenge.user_id == user.id,
            EmailVerificationChallenge.consumed_at.is_(None),
        )
        .values(consumed_at=current)
    )
    db_session.add(
        EmailVerificationChallenge(
            id=challenge_id,
            user_id=user.id,
            email_at_issue=user.email,
            code_hash=hash_email_verification_code(
                challenge_id=challenge_id, code=code, settings=settings
            ),
            attempt_count=0,
            expires_at=current + CODE_LIFETIME,
            created_at=current,
        )
    )
    db_session.flush()
    return IssueVerificationResult(
        IssueVerificationStatus.ISSUED,
        VerificationCodeMaterial(
            recipient=user.email,
            code=code,
            expires_at=current + CODE_LIFETIME,
        ),
    )


def confirm_email_verification(
    *,
    db_session: Session,
    authenticated_user_id: UUID,
    code: str,
    settings: Settings,
    now: datetime | None = None,
) -> VerifyEmailStatus:
    """Consume one proof and verify only the current account email, atomically.

    INVALID results that increment attempt counts MUST be committed by the caller.
    """
    current = _now(now)
    _key(settings)
    if len(code) != 6 or not code.isascii() or not code.isdecimal():
        return VerifyEmailStatus.INVALID

    user = db_session.scalar(select(User).where(User.id == authenticated_user_id).with_for_update())
    if user is None or not user.is_active:
        return VerifyEmailStatus.INVALID
    if user.email_verified_at is not None:
        return VerifyEmailStatus.ALREADY_VERIFIED

    challenge = db_session.scalar(
        select(EmailVerificationChallenge)
        .where(
            EmailVerificationChallenge.user_id == user.id,
            EmailVerificationChallenge.consumed_at.is_(None),
        )
        .order_by(EmailVerificationChallenge.created_at.desc())
        .limit(1)
        .with_for_update()
    )
    if challenge is None:
        return VerifyEmailStatus.INVALID
    if (
        challenge.email_at_issue != user.email
        or challenge.expires_at <= current
        or challenge.attempt_count >= MAX_ATTEMPTS
    ):
        challenge.consumed_at = current
        return VerifyEmailStatus.INVALID

    expected = hash_email_verification_code(challenge_id=challenge.id, code=code, settings=settings)
    if not hmac.compare_digest(expected, challenge.code_hash):
        challenge.attempt_count += 1
        if challenge.attempt_count >= MAX_ATTEMPTS:
            challenge.consumed_at = current
        return VerifyEmailStatus.INVALID

    user.email_verified_at = current
    db_session.execute(
        update(EmailVerificationChallenge)
        .where(
            EmailVerificationChallenge.user_id == user.id,
            EmailVerificationChallenge.consumed_at.is_(None),
        )
        .values(consumed_at=current)
    )
    db_session.flush()
    return VerifyEmailStatus.VERIFIED
