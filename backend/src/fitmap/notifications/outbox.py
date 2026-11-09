"""Internal transactional outbox foundation; no dispatcher or HTTP routes.

Queue inside the SAME database transaction as the matching challenge, then commit.
Never call a network transport before commit. The dispatcher/lease/idempotency
integration is deliberately deferred to a separate, tested milestone.
"""

import json
from datetime import UTC, datetime, timedelta
from typing import Literal, cast
from uuid import UUID, uuid4

from cryptography.fernet import Fernet, InvalidToken
from pydantic import SecretStr
from sqlalchemy.orm import Session

from fitmap.config import Settings
from fitmap.notifications.email import OutboundEmail
from fitmap.notifications.outbox_models import EmailOutboxMessage

OutboxPurpose = Literal["email_verification", "password_recovery"]


class OutboxConfigurationError(RuntimeError):
    """Invalid server-side key; no sensitive values in error messages."""


class OutboxPayloadError(RuntimeError):
    """Encrypted payload was invalid or unavailable; fail closed."""


def _cipher(settings: Settings) -> Fernet:
    configured: SecretStr | None = settings.email_outbox_encryption_key
    if configured is None:
        raise OutboxConfigurationError("Email outbox encryption is not configured.")
    key = configured.get_secret_value()
    if key in {
        settings.auth_jwt_secret.get_secret_value(),
        settings.auth_recovery_code_secret.get_secret_value()
        if settings.auth_recovery_code_secret is not None
        else "",
        settings.auth_email_verification_secret.get_secret_value()
        if settings.auth_email_verification_secret is not None
        else "",
    }:
        raise OutboxConfigurationError("Outbox encryption key must be independent.")
    try:
        return Fernet(key.encode())
    except (ValueError, TypeError):
        raise OutboxConfigurationError("Invalid email outbox encryption key.") from None


def _aware(value: datetime) -> bool:
    return value.tzinfo is not None and value.utcoffset() is not None


def enqueue_outbox_email(
    *,
    db_session: Session,
    user_id: UUID,
    purpose: OutboxPurpose,
    message: OutboundEmail,
    expires_at: datetime,
    settings: Settings,
    now: datetime | None = None,
) -> EmailOutboxMessage:
    """Stage encrypted email atomically with its challenge; caller commits or rolls back.

    This function does not emit, commit, log, or return the plaintext message.
    If the containing transaction rolls back, the outbox row rolls back too.
    """
    current = now if now is not None else datetime.now(UTC)
    if (
        not _aware(current)
        or not _aware(expires_at)
        or expires_at <= current
        or expires_at > current + timedelta(minutes=10)
    ):
        raise ValueError("Outbox expiration must be future and timezone-aware.")
    if purpose not in ("email_verification", "password_recovery"):
        raise ValueError("Unsupported outbox purpose.")
    if (
        not message.recipient
        or len(message.recipient) > 320
        or not message.subject
        or len(message.subject) > 160
        or not message.text_body
        or len(message.text_body) > 4000
        or any(char in message.recipient + message.subject for char in "\r\n")
    ):
        raise ValueError("Invalid transactional email.")
    plaintext = json.dumps(
        {
            "recipient": message.recipient,
            "subject": message.subject,
            "text_body": message.text_body,
        },
        ensure_ascii=False,
    ).encode()
    encrypted = _cipher(settings).encrypt(plaintext)
    message_id = uuid4()
    row = EmailOutboxMessage(
        id=message_id,
        user_id=user_id,
        purpose=purpose,
        encrypted_payload=encrypted,
        key_version=1,
        idempotency_key=f"fitmap-{message_id.hex}",
        status="pending",
        attempt_count=0,
        expires_at=expires_at,
        created_at=current,
    )
    db_session.add(row)
    db_session.flush()
    return row


def decrypt_outbox_email(
    *, row: EmailOutboxMessage, settings: Settings, now: datetime | None = None
) -> OutboundEmail:
    """Decode only in a trusted dispatcher, after commit and before expiration.

    This helper never sends messages and must not be used in HTTP responses.
    """
    current = now if now is not None else datetime.now(UTC)
    if not _aware(current):
        raise ValueError("Outbox timestamps must be timezone-aware.")
    if row.key_version != 1 or row.status not in ("pending", "processing"):
        raise OutboxPayloadError("Outbox message is not available.")
    if not _aware(row.expires_at) or row.expires_at <= current:
        raise OutboxPayloadError("Outbox message is not available.")
    try:
        plaintext = _cipher(settings).decrypt(row.encrypted_payload)
        decoded: object = json.loads(plaintext)
        if not isinstance(decoded, dict):
            raise ValueError("Unexpected payload")
        data = cast(dict[str, object], decoded)
        if set(data) != {"recipient", "subject", "text_body"}:
            raise ValueError("Unexpected payload")
        recipient, subject, body = data["recipient"], data["subject"], data["text_body"]
        if not all(isinstance(value, str) and value for value in (recipient, subject, body)):
            raise ValueError("Unexpected payload")
        return OutboundEmail(
            recipient=cast(str, recipient), subject=cast(str, subject), text_body=cast(str, body)
        )
    except (InvalidToken, UnicodeDecodeError, json.JSONDecodeError, ValueError, TypeError):
        raise OutboxPayloadError("Outbox message could not be decoded.") from None
