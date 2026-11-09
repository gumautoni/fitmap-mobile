"""Opt-in, single-message transactional-outbox dispatcher.

No scheduler, startup hook, background task, HTTP route, or production provider
is enabled here. Caller must supply an explicit configured idempotent transport.
"""

import hmac
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from enum import StrEnum
from typing import Protocol
from uuid import UUID, uuid4

from sqlalchemy import and_, or_, select, update
from sqlalchemy.orm import Session

from fitmap.config import Settings
from fitmap.identity.email_verification import hash_email_verification_code
from fitmap.identity.models import User
from fitmap.identity.password_recovery import hash_recovery_code
from fitmap.identity.recovery_models import PasswordRecoveryChallenge
from fitmap.identity.verification_models import EmailVerificationChallenge
from fitmap.notifications.email import OutboundEmail
from fitmap.notifications.outbox import (
    OutboxConfigurationError,
    OutboxPayloadError,
    decrypt_outbox_email,
)
from fitmap.notifications.outbox_models import EmailOutboxMessage
from fitmap.notifications.resend import EmailDeliveryError

LEASE_DURATION = timedelta(seconds=45)
MAX_SEND_ATTEMPTS = 3
RETRY_BACKOFF = (timedelta(seconds=15), timedelta(seconds=60))


class IdempotentEmailTransport(Protocol):
    """Provider that sends the same payload under the same key on every retry."""

    def send(self, message: OutboundEmail, *, idempotency_key: str) -> None: ...


class DispatchOutcome(StrEnum):
    IDLE = "idle"
    ACCEPTED = "accepted"
    RETRY_SCHEDULED = "retry_scheduled"
    FAILED = "failed"
    DISCARDED = "discarded"


@dataclass(frozen=True, slots=True, repr=False)
class _Lease:
    id: UUID
    token: UUID
    row: EmailOutboxMessage


def _now(value: datetime | None) -> datetime:
    current = value if value is not None else datetime.now(UTC)
    if current.tzinfo is None or current.utcoffset() is None:
        raise ValueError("Dispatcher timestamps must be timezone-aware.")
    return current


def _claim(session_factory: Callable[[], Session], now: datetime) -> _Lease | None:
    # The claim is committed BEFORE any decryption and network I/O.
    with session_factory() as db_session, db_session.begin():
        # Expired or exhausted messages cannot be retried. Delete encrypted PINs.
        db_session.execute(
            update(EmailOutboxMessage)
            .where(
                EmailOutboxMessage.status.in_(("pending", "processing")),
                EmailOutboxMessage.expires_at <= now,
            )
            .values(status="expired", encrypted_payload=b"", lease_token=None, leased_until=None)
        )
        db_session.execute(
            update(EmailOutboxMessage)
            .where(
                EmailOutboxMessage.status.in_(("pending", "processing")),
                EmailOutboxMessage.attempt_count >= MAX_SEND_ATTEMPTS,
                or_(
                    EmailOutboxMessage.status == "pending",
                    EmailOutboxMessage.leased_until <= now,
                ),
            )
            .values(status="failed", encrypted_payload=b"", lease_token=None, leased_until=None)
        )
        row = db_session.scalar(
            select(EmailOutboxMessage)
            .where(
                EmailOutboxMessage.expires_at > now,
                EmailOutboxMessage.attempt_count < MAX_SEND_ATTEMPTS,
                or_(
                    and_(
                        EmailOutboxMessage.status == "pending",
                        or_(
                            EmailOutboxMessage.next_attempt_at.is_(None),
                            EmailOutboxMessage.next_attempt_at <= now,
                        ),
                    ),
                    and_(
                        EmailOutboxMessage.status == "processing",
                        EmailOutboxMessage.leased_until <= now,
                    ),
                ),
            )
            .order_by(EmailOutboxMessage.created_at, EmailOutboxMessage.id)
            .limit(1)
            .with_for_update(skip_locked=True)
        )
        if row is None:
            return None
        token = uuid4()
        row.status = "processing"
        row.attempt_count += 1
        row.last_attempt_at = now
        row.lease_token = token
        row.leased_until = now + LEASE_DURATION
        # Copy ciphertext to an untracked object, so the transaction is closed
        # and row locks are released before the provider can be contacted.
        snapshot = EmailOutboxMessage(
            id=row.id,
            user_id=row.user_id,
            purpose=row.purpose,
            encrypted_payload=row.encrypted_payload,
            key_version=row.key_version,
            idempotency_key=row.idempotency_key,
            status="processing",
            attempt_count=row.attempt_count,
            expires_at=row.expires_at,
        )
        return _Lease(id=row.id, token=token, row=snapshot)


def _challenge_is_valid(
    *,
    session_factory: Callable[[], Session],
    row: EmailOutboxMessage,
    message: OutboundEmail,
    settings: Settings,
    now: datetime,
) -> bool:
    # The PIN must still be the currently usable code for this account.
    # Older codes invalidated by reissue/reset never go to the provider.
    with session_factory() as db_session:
        user = db_session.get(User, row.user_id)
        if user is None or not user.is_active or user.email != message.recipient:
            return False
        if row.purpose == "email_verification":
            if user.email_verified_at is not None:
                return False
            challenge = db_session.scalar(
                select(EmailVerificationChallenge)
                .where(
                    EmailVerificationChallenge.user_id == row.user_id,
                    EmailVerificationChallenge.consumed_at.is_(None),
                )
                .order_by(EmailVerificationChallenge.created_at.desc())
                .limit(1)
            )
            if (
                challenge is None
                or challenge.email_at_issue != user.email
                or challenge.expires_at <= now
                or challenge.attempt_count >= 5
            ):
                return False
            expected = hash_email_verification_code(
                challenge_id=challenge.id,
                code=_extract_code(message, "verification"),
                settings=settings,
            )
            return hmac.compare_digest(expected, challenge.code_hash)
        if row.purpose == "password_recovery":
            if user.email_verified_at is None:
                return False
            challenge = db_session.scalar(
                select(PasswordRecoveryChallenge)
                .where(
                    PasswordRecoveryChallenge.user_id == row.user_id,
                    PasswordRecoveryChallenge.consumed_at.is_(None),
                )
                .order_by(PasswordRecoveryChallenge.created_at.desc())
                .limit(1)
            )
            if challenge is None or challenge.expires_at <= now or challenge.attempt_count >= 5:
                return False
            expected = hash_recovery_code(
                challenge_id=challenge.id,
                code=_extract_code(message, "recovery"),
                settings=settings,
            )
            return hmac.compare_digest(expected, challenge.code_hash)
        return False


def _extract_code(message: OutboundEmail, purpose: str) -> str:
    # Only the application's own fixed-format builders may enqueue security codes.
    prefix = (
        "Código de verificação: " if purpose == "verification" else "Seu código de recuperação: "
    )
    for line in message.text_body.splitlines():
        if line.startswith(prefix):
            code = line.removeprefix(prefix)
            if len(code) == 6 and code.isascii() and code.isdecimal():
                return code
    return ""  # Invalid/altered template is treated as ineligible.


def _complete(
    *,
    session_factory: Callable[[], Session],
    lease: _Lease,
    now: datetime,
    status: str,
    next_attempt_at: datetime | None = None,
) -> None:
    values: dict[str, object] = {
        "status": status,
        "lease_token": None,
        "leased_until": None,
        "next_attempt_at": next_attempt_at,
    }
    if status in ("accepted", "failed", "expired"):
        values["encrypted_payload"] = b""
    if status == "accepted":
        values["accepted_at"] = now
    with session_factory() as db_session, db_session.begin():
        db_session.execute(
            update(EmailOutboxMessage)
            .where(
                EmailOutboxMessage.id == lease.id,
                EmailOutboxMessage.lease_token == lease.token,
                EmailOutboxMessage.status == "processing",
            )
            .values(**values)
        )


def dispatch_one_email(
    *,
    session_factory: Callable[[], Session],
    settings: Settings,
    transport: IdempotentEmailTransport,
    now: datetime | None = None,
) -> DispatchOutcome:
    """Process at most one due message, without any autonomous worker or scheduler.

    DB locks cover ONLY the claim/finish transactions. Retry attempts reuse the
    original Resend key and identical payload. No plaintext is stored at rest.
    """
    current = _now(now)
    lease = _claim(session_factory, current)
    if lease is None:
        return DispatchOutcome.IDLE
    try:
        message = decrypt_outbox_email(row=lease.row, settings=settings, now=current)
        if not _challenge_is_valid(
            session_factory=session_factory,
            row=lease.row,
            message=message,
            settings=settings,
            now=current,
        ):
            _complete(session_factory=session_factory, lease=lease, now=current, status="failed")
            return DispatchOutcome.DISCARDED
    except OutboxConfigurationError:
        # Missing/misconfigured server key is operational, not a bad message.
        # Preserve the ciphertext and allow lease recovery after configuration is fixed.
        raise
    except (OutboxPayloadError, ValueError, RuntimeError):
        _complete(session_factory=session_factory, lease=lease, now=current, status="failed")
        return DispatchOutcome.DISCARDED
    try:
        transport.send(message, idempotency_key=lease.row.idempotency_key)
    except EmailDeliveryError as exc:
        if exc.retryable and lease.row.attempt_count < MAX_SEND_ATTEMPTS:
            delay = RETRY_BACKOFF[lease.row.attempt_count - 1]
            if current + delay < lease.row.expires_at:
                _complete(
                    session_factory=session_factory,
                    lease=lease,
                    now=current,
                    status="pending",
                    next_attempt_at=current + delay,
                )
                return DispatchOutcome.RETRY_SCHEDULED
        _complete(session_factory=session_factory, lease=lease, now=current, status="failed")
        return DispatchOutcome.FAILED
    _complete(session_factory=session_factory, lease=lease, now=current, status="accepted")
    return DispatchOutcome.ACCEPTED
