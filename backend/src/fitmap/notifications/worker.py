"""Manual, bounded outbox execution; never started by FastAPI or by an import.

The default CLI command is read-only. Real delivery additionally requires
explicit CLI confirmation, an enabled worker flag and validated Resend config.
"""

import argparse
import json
import sys
from binascii import Error as BinasciiError
from collections.abc import Callable, Sequence
from dataclasses import asdict, dataclass
from datetime import UTC, datetime

from cryptography.fernet import Fernet
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from fitmap.config import Settings, get_settings
from fitmap.notifications.dispatcher import (
    DispatchOutcome,
    IdempotentEmailTransport,
    dispatch_one_email,
)
from fitmap.notifications.outbox_models import EmailOutboxMessage
from fitmap.notifications.resend import create_resend_transport

MAX_BATCH_SIZE = 25
SEND_CONFIRMATION = "SEND_REAL_EMAILS"


class WorkerConfigurationError(RuntimeError):
    """A production operation was blocked before DB or network access."""


@dataclass(frozen=True, slots=True)
class OutboxCounts:
    pending: int = 0
    processing: int = 0
    accepted: int = 0
    failed: int = 0
    expired: int = 0


@dataclass(frozen=True, slots=True)
class BatchResult:
    processed: int
    accepted: int
    retry_scheduled: int
    failed: int
    discarded: int
    idle: bool


def inspect_outbox(*, session_factory: Callable[[], Session]) -> OutboxCounts:
    """Read counts only. Never decrypt, claim, delete or publish messages."""
    counts = {key: 0 for key in ("pending", "processing", "accepted", "failed", "expired")}
    with session_factory() as db_session:
        statement = select(EmailOutboxMessage.status, func.count(EmailOutboxMessage.id)).group_by(
            EmailOutboxMessage.status
        )
        for state, count in db_session.execute(statement):
            if state in counts:
                counts[state] = int(count)
    return OutboxCounts(
        pending=counts["pending"],
        processing=counts["processing"],
        accepted=counts["accepted"],
        failed=counts["failed"],
        expired=counts["expired"],
    )


def dispatch_email_batch(
    *,
    session_factory: Callable[[], Session],
    settings: Settings,
    transport: IdempotentEmailTransport,
    max_messages: int = 1,
    now: datetime | None = None,
) -> BatchResult:
    """Execute at most N dispatcher attempts with a caller-supplied transport.

    Does not schedule itself or retry in a tight loop: the dispatcher persists
    retry deadlines; the next manual invocation can process them later.
    """
    if not 1 <= max_messages <= MAX_BATCH_SIZE:
        raise ValueError("The worker batch size must be between 1 and 25.")
    current = now if now is not None else datetime.now(UTC)
    if current.tzinfo is None or current.utcoffset() is None:
        raise ValueError("Worker timestamps must be timezone-aware.")

    counts = {
        DispatchOutcome.ACCEPTED: 0,
        DispatchOutcome.RETRY_SCHEDULED: 0,
        DispatchOutcome.FAILED: 0,
        DispatchOutcome.DISCARDED: 0,
    }
    idle = False
    for _ in range(max_messages):
        outcome = dispatch_one_email(
            session_factory=session_factory,
            settings=settings,
            transport=transport,
            now=current,
        )
        if outcome is DispatchOutcome.IDLE:
            idle = True
            break
        counts[outcome] += 1
    return BatchResult(
        processed=sum(counts.values()),
        accepted=counts[DispatchOutcome.ACCEPTED],
        retry_scheduled=counts[DispatchOutcome.RETRY_SCHEDULED],
        failed=counts[DispatchOutcome.FAILED],
        discarded=counts[DispatchOutcome.DISCARDED],
        idle=idle,
    )


def validate_live_worker_settings(settings: Settings) -> None:
    """Fail closed before constructing a provider or opening the database."""
    if (
        not settings.email_worker_enabled
        or settings.environment not in ("staging", "production")
        or settings.email_provider != "resend"
        or settings.resend_api_key is None
        or settings.email_from_address is None
    ):
        raise WorkerConfigurationError("Live email worker is disabled or incomplete.")

    required = (
        settings.auth_jwt_secret,
        settings.auth_recovery_code_secret,
        settings.auth_email_verification_secret,
        settings.email_outbox_encryption_key,
    )
    if any(secret is None for secret in required):
        raise WorkerConfigurationError("Security secrets are not configured.")

    # The JWT secret is always present; the three optional secrets were checked above.
    values = [secret.get_secret_value() for secret in required if secret is not None]
    if len(values) != 4 or len(set(values)) != len(values):
        raise WorkerConfigurationError("Worker secrets must be independent.")
    if any(len(value.encode("utf-8")) < 32 for value in values[:3]):
        raise WorkerConfigurationError("Worker secrets are too short.")

    # Encrypted rows must be decryptable. No message is read during validation.
    try:
        Fernet(values[3].encode("utf-8"))
    except (ValueError, TypeError, BinasciiError):
        raise WorkerConfigurationError("Invalid outbox encryption configuration.") from None


def _open_sessions() -> Callable[[], Session]:
    # Import lazily: merely calling --help cannot connect to a database or load
    # the application's globally configured SQLAlchemy engine.
    from fitmap.persistence.database import session_factory

    return session_factory


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="FitMap manual transactional email outbox worker")
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Opt in to live provider delivery (requires further safeguards).",
    )
    parser.add_argument(
        "--confirm-send",
        help="For live execution, supply the exact text SEND_REAL_EMAILS.",
    )
    parser.add_argument("--max-messages", type=int, default=1)
    args = parser.parse_args(argv)

    if not 1 <= args.max_messages <= MAX_BATCH_SIZE:
        parser.error("--max-messages must be between 1 and 25")
    if args.execute and args.confirm_send != SEND_CONFIRMATION:
        print("Live delivery blocked: explicit confirmation required.", file=sys.stderr)
        return 2
    if not args.execute and args.confirm_send is not None:
        print("Confirmation is only accepted with --execute.", file=sys.stderr)
        return 2

    try:
        settings = get_settings()
        if args.execute:
            validate_live_worker_settings(settings)
            transport = create_resend_transport(settings)
            batch = dispatch_email_batch(
                session_factory=_open_sessions(),
                settings=settings,
                transport=transport,
                max_messages=args.max_messages,
            )
            print(json.dumps(asdict(batch), sort_keys=True))
        else:
            # Default mode has no network/provider delivery or DB writes.
            counts = inspect_outbox(session_factory=_open_sessions())
            print(json.dumps(asdict(counts), sort_keys=True))
        return 0
    except Exception as exc:
        # Never echo the provider payload, recipient, PIN, credential or SQL URL.
        print(f"Worker operation blocked or failed ({type(exc).__name__}).", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
