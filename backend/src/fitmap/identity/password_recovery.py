"""Internal password-recovery domain operations. No public HTTP route is enabled here.

Callers are responsible for committing transactions on any returned status, and for
rolling back on delivery failures. A production sender and durable delivery strategy
must be implemented before exposing a request endpoint.
"""

import hmac
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from enum import StrEnum
from hashlib import sha256
from typing import Protocol
from uuid import UUID, uuid4

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from fitmap.config import Settings
from fitmap.identity.accounts import normalize_email
from fitmap.identity.models import AuthRefreshToken, AuthSession, User
from fitmap.identity.recovery_models import PasswordRecoveryChallenge
from fitmap.identity.schemas import validate_registration_password
from fitmap.identity.security import hash_password

CODE_LIFETIME = timedelta(minutes=10)
SEND_COOLDOWN = timedelta(seconds=60)
SEND_WINDOW = timedelta(hours=1)
MAX_SENDS_PER_HOUR = 3
MAX_ATTEMPTS = 5


class RecoveryCodeSender(Protocol):
    """External delivery port. Never log or persist the plaintext code."""

    def send_recovery_code(self, *, email: str, code: str, expires_at: datetime) -> None: ...


class IssueStatus(StrEnum):
    SENT = "sent"
    INELIGIBLE = "ineligible"
    RATE_LIMITED = "rate_limited"


class ResetStatus(StrEnum):
    RESET = "reset"
    INVALID = "invalid"


@dataclass(frozen=True, slots=True, repr=False)
class GeneratedRecoveryCode:
    value: str
    challenge_id: UUID
    expires_at: datetime


def generate_recovery_code(*, now: datetime | None = None) -> GeneratedRecoveryCode:
    current = now or datetime.now(UTC)
    if current.tzinfo is None:
        raise ValueError("Recovery timestamps must include a timezone.")
    return GeneratedRecoveryCode(
        value=f"{secrets.randbelow(1_000_000):06d}",
        challenge_id=uuid4(),
        expires_at=current + CODE_LIFETIME,
    )


def _recovery_key(settings: Settings) -> bytes:
    secret = settings.auth_recovery_code_secret
    if secret is None or len(secret.get_secret_value()) < 32:
        raise RuntimeError("A distinct recovery-code secret (32+ chars) must be configured.")
    if secret.get_secret_value() == settings.auth_jwt_secret.get_secret_value():
        raise RuntimeError("Recovery-code and JWT secrets must be distinct.")
    return secret.get_secret_value().encode("utf-8")


def hash_recovery_code(*, challenge_id: UUID, code: str, settings: Settings) -> str:
    """Bind a low-entropy PIN to a challenge ID with a keyed HMAC-SHA256."""
    message = f"fitmap-password-recovery:{challenge_id}:{code}".encode()
    return hmac.new(_recovery_key(settings), message, sha256).hexdigest()


def issue_recovery_code(
    *,
    db_session: Session,
    user_id: UUID,
    sender: RecoveryCodeSender,
    settings: Settings,
    now: datetime | None = None,
) -> IssueStatus:
    """Issue for a previously verified email only; no public API must expose status.

    The caller must roll back if the sender raises. A real sender must only be
    activated after delivery/commit ordering is addressed by the integration.
    """
    current = now or datetime.now(UTC)
    if current.tzinfo is None:
        raise ValueError("Recovery timestamps must include a timezone.")
    key = _recovery_key(settings)

    # Lock the user to serialize concurrent issues and resets for this account.
    user = db_session.scalar(select(User).where(User.id == user_id).with_for_update())
    if user is None or not user.is_active or user.email_verified_at is None:
        return IssueStatus.INELIGIBLE

    previous = db_session.scalars(
        select(PasswordRecoveryChallenge)
        .where(
            PasswordRecoveryChallenge.user_id == user.id,
            PasswordRecoveryChallenge.created_at >= current - SEND_WINDOW,
        )
        .order_by(PasswordRecoveryChallenge.created_at.desc())
    ).all()

    if len(previous) >= MAX_SENDS_PER_HOUR:
        return IssueStatus.RATE_LIMITED
    if previous and previous[0].created_at > current - SEND_COOLDOWN:
        return IssueStatus.RATE_LIMITED

    material = generate_recovery_code(now=current)
    digest = hmac.new(
        key,
        f"fitmap-password-recovery:{material.challenge_id}:{material.value}".encode(),
        sha256,
    ).hexdigest()

    db_session.execute(
        update(PasswordRecoveryChallenge)
        .where(
            PasswordRecoveryChallenge.user_id == user.id,
            PasswordRecoveryChallenge.consumed_at.is_(None),
        )
        .values(consumed_at=current)
    )
    db_session.add(
        PasswordRecoveryChallenge(
            id=material.challenge_id,
            user_id=user.id,
            code_hash=digest,
            attempt_count=0,
            expires_at=material.expires_at,
            created_at=current,
        )
    )
    db_session.flush()

    sender.send_recovery_code(
        email=user.email,
        code=material.value,
        expires_at=material.expires_at,
    )
    return IssueStatus.SENT


def reset_password_with_code(
    *,
    db_session: Session,
    email: str,
    code: str,
    new_password: str,
    settings: Settings,
    now: datetime | None = None,
) -> ResetStatus:
    """Atomically consume PIN, replace Argon2id hash and revoke all sessions.

    INVALID attempts increment their counter; callers must commit INVALID results
    as well (never raise and roll back failed-attempt accounting).
    """
    current = now or datetime.now(UTC)
    if current.tzinfo is None:
        raise ValueError("Recovery timestamps must include a timezone.")
    _recovery_key(settings)
    # Validate first, including when domain service is invoked without Pydantic.
    if not 8 <= len(new_password) <= 128:
        raise ValueError("Invalid password length.")
    validate_registration_password(new_password)
    if len(code) != 6 or not code.isascii() or not code.isdecimal():
        return ResetStatus.INVALID

    user = db_session.scalar(
        select(User).where(User.email == normalize_email(email)).with_for_update()
    )
    if user is None or not user.is_active or user.email_verified_at is None:
        return ResetStatus.INVALID

    challenge = db_session.scalar(
        select(PasswordRecoveryChallenge)
        .where(
            PasswordRecoveryChallenge.user_id == user.id,
            PasswordRecoveryChallenge.consumed_at.is_(None),
        )
        .order_by(PasswordRecoveryChallenge.created_at.desc())
        .limit(1)
        .with_for_update()
    )
    if challenge is None:
        return ResetStatus.INVALID

    if challenge.expires_at <= current or challenge.attempt_count >= MAX_ATTEMPTS:
        challenge.consumed_at = current
        return ResetStatus.INVALID

    expected = hash_recovery_code(challenge_id=challenge.id, code=code, settings=settings)
    if not hmac.compare_digest(challenge.code_hash, expected):
        challenge.attempt_count += 1
        if challenge.attempt_count >= MAX_ATTEMPTS:
            challenge.consumed_at = current
        return ResetStatus.INVALID

    user.password_hash = hash_password(new_password)
    db_session.execute(
        update(AuthSession)
        .where(AuthSession.user_id == user.id, AuthSession.revoked_at.is_(None))
        .values(revoked_at=current)
    )
    db_session.execute(
        update(AuthRefreshToken)
        .where(
            AuthRefreshToken.session_id.in_(
                select(AuthSession.id).where(AuthSession.user_id == user.id)
            ),
            AuthRefreshToken.revoked_at.is_(None),
        )
        .values(revoked_at=current)
    )
    db_session.execute(
        update(PasswordRecoveryChallenge)
        .where(
            PasswordRecoveryChallenge.user_id == user.id,
            PasswordRecoveryChallenge.consumed_at.is_(None),
        )
        .values(consumed_at=current)
    )
    db_session.flush()
    return ResetStatus.RESET
