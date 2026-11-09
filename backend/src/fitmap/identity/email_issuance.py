"""Internal security-code issuance to an encrypted transactional outbox.

These functions stage the challenge and its email in one database transaction.
They do NOT commit or contact a provider. A trusted caller must commit the
transaction; the separate dispatcher runs only after that durable commit.
Neither function may be exposed directly as an HTTP endpoint.
"""

from datetime import UTC, datetime
from enum import StrEnum
from uuid import UUID

from sqlalchemy.orm import Session

from fitmap.config import Settings
from fitmap.identity.email_verification import (
    IssueVerificationStatus,
    issue_email_verification,
)
from fitmap.identity.password_recovery import IssueStatus, issue_recovery_code
from fitmap.notifications.outbox import enqueue_outbox_email
from fitmap.notifications.recovery import build_recovery_email
from fitmap.notifications.verification import build_email_verification_message


class EnqueueStatus(StrEnum):
    QUEUED = "queued"
    INELIGIBLE = "ineligible"
    RATE_LIMITED = "rate_limited"


def _now(now: datetime | None) -> datetime:
    current = now if now is not None else datetime.now(UTC)
    if current.tzinfo is None or current.utcoffset() is None:
        raise ValueError("Code issuance timestamps must be timezone-aware.")
    return current


class _RecoveryOutboxSender:
    """Never sends over the network: it only enqueues encrypted DB rows."""

    def __init__(
        self,
        *,
        db_session: Session,
        user_id: UUID,
        settings: Settings,
        now: datetime,
    ) -> None:
        self._db_session = db_session
        self._user_id = user_id
        self._settings = settings
        self._now = now

    def send_recovery_code(self, *, email: str, code: str, expires_at: datetime) -> None:
        enqueue_outbox_email(
            db_session=self._db_session,
            user_id=self._user_id,
            purpose="password_recovery",
            message=build_recovery_email(email=email, code=code, expires_at=expires_at),
            expires_at=expires_at,
            settings=self._settings,
            now=self._now,
        )


def queue_email_verification(
    *,
    db_session: Session,
    authenticated_user_id: UUID,
    settings: Settings,
    now: datetime | None = None,
) -> EnqueueStatus:
    """Stage a verification challenge and encrypted email atomically.

    The caller MUST supply an authenticated session-derived user ID and commit
    the enclosing transaction. On an enqueue failure the nested SAVEPOINT
    rolls back both the new challenge and invalidations of previous codes.
    """
    current = _now(now)
    with db_session.begin_nested():
        result = issue_email_verification(
            db_session=db_session,
            authenticated_user_id=authenticated_user_id,
            settings=settings,
            now=current,
        )
        if result.status is IssueVerificationStatus.INELIGIBLE:
            return EnqueueStatus.INELIGIBLE
        if result.status is IssueVerificationStatus.RATE_LIMITED:
            return EnqueueStatus.RATE_LIMITED
        if result.material is None:
            raise RuntimeError("Verification challenge was not prepared.")
        enqueue_outbox_email(
            db_session=db_session,
            user_id=authenticated_user_id,
            purpose="email_verification",
            message=build_email_verification_message(
                recipient=result.material.recipient,
                code=result.material.code,
                expires_at=result.material.expires_at,
            ),
            expires_at=result.material.expires_at,
            settings=settings,
            now=current,
        )
    return EnqueueStatus.QUEUED


def queue_password_recovery(
    *,
    db_session: Session,
    user_id: UUID,
    settings: Settings,
    now: datetime | None = None,
) -> EnqueueStatus:
    """Stage a recovery challenge and encrypted email atomically, never send.

    This internal service accepts an already resolved user ID. The future HTTP
    boundary must conceal eligibility and enforce network/identifier limits.
    The legacy domain sender port is satisfied by a DB-only adapter, so the
    provider is NEVER contacted in this transaction.
    """
    current = _now(now)
    with db_session.begin_nested():
        status = issue_recovery_code(
            db_session=db_session,
            user_id=user_id,
            sender=_RecoveryOutboxSender(
                db_session=db_session,
                user_id=user_id,
                settings=settings,
                now=current,
            ),
            settings=settings,
            now=current,
        )
    if status is IssueStatus.INELIGIBLE:
        return EnqueueStatus.INELIGIBLE
    if status is IssueStatus.RATE_LIMITED:
        return EnqueueStatus.RATE_LIMITED
    if status is IssueStatus.SENT:
        # SENT is the legacy domain name; the adapter has only queued a row.
        return EnqueueStatus.QUEUED
    raise RuntimeError("Unrecognized recovery issuance status.")
