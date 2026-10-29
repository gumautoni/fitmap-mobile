"""Encrypted outbox foundation: in-memory database, never delivers to a provider."""

from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from typing import cast
from uuid import UUID, uuid4

import pytest
from cryptography.fernet import Fernet
from pydantic import SecretStr
from sqlalchemy import Engine, select
from sqlalchemy.orm import Session

from fitmap.config import Settings
from fitmap.identity.models import User
from fitmap.identity.verification_models import EmailVerificationChallenge
from fitmap.notifications.email import OutboundEmail
from fitmap.notifications.outbox import (
    OutboxConfigurationError,
    OutboxPayloadError,
    OutboxPurpose,
    decrypt_outbox_email,
    enqueue_outbox_email,
)
from fitmap.notifications.outbox_models import EmailOutboxMessage

NOW = datetime(2026, 10, 29, 20, 0, tzinfo=UTC)
EXPIRY = NOW + timedelta(minutes=10)
MESSAGE = OutboundEmail(
    recipient="secret@example.com",
    subject="FitMap | Confirme seu email",
    text_body="Seu codigo e 001234. Nao compartilhe.",
)


@pytest.fixture
def db_session(database_engine: Engine) -> Iterator[Session]:
    connection = database_engine.connect()
    transaction = connection.begin()
    session = Session(bind=connection, expire_on_commit=False)
    try:
        yield session
    finally:
        session.close()
        if transaction.is_active:
            transaction.rollback()
        connection.close()


@pytest.fixture
def outbox_settings(test_settings: Settings) -> Settings:
    return test_settings.model_copy(
        update={
            "email_outbox_encryption_key": SecretStr(Fernet.generate_key().decode()),
        }
    )


def user(db_session: Session) -> User:
    new = User(
        id=uuid4(),
        name="Outbox Test",
        email=f"outbox-{uuid4()}@example.com",
        password_hash="unused",
    )
    db_session.add(new)
    db_session.flush()
    return new


def queue(db_session: Session, settings: Settings, user_id: UUID) -> EmailOutboxMessage:
    return enqueue_outbox_email(
        db_session=db_session,
        user_id=user_id,
        purpose="email_verification",
        message=MESSAGE,
        expires_at=EXPIRY,
        settings=settings,
        now=NOW,
    )


def test_default_disabled(test_settings: Settings, db_session: Session) -> None:
    row_user = user(db_session)
    disabled = test_settings.model_copy(update={"email_outbox_encryption_key": None})
    with pytest.raises(OutboxConfigurationError, match="not configured"):
        queue(db_session, disabled, row_user.id)
    assert db_session.scalars(select(EmailOutboxMessage)).all() == []


def test_round_trip_and_ciphertext_never_exposes_code_or_email(
    outbox_settings: Settings, db_session: Session
) -> None:
    row_user = user(db_session)
    row = queue(db_session, outbox_settings, row_user.id)
    db_session.commit()
    assert row.status == "pending"
    assert row.attempt_count == 0
    assert row.key_version == 1
    assert row.expires_at == EXPIRY
    assert row.encrypted_payload != MESSAGE.text_body.encode()
    assert b"001234" not in row.encrypted_payload
    assert b"secret@example.com" not in row.encrypted_payload
    assert "001234" not in repr(row)
    assert "secret@example.com" not in repr(row)
    assert decrypt_outbox_email(row=row, settings=outbox_settings, now=NOW) == MESSAGE


def test_idempotency_key_is_stable_and_unique(
    outbox_settings: Settings, db_session: Session
) -> None:
    row_user = user(db_session)
    first = queue(db_session, outbox_settings, row_user.id)
    second = queue(db_session, outbox_settings, row_user.id)
    assert first.idempotency_key == f"fitmap-{first.id.hex}"
    assert first.idempotency_key != second.idempotency_key


def test_rollback_also_drops_outbox_and_challenge(
    outbox_settings: Settings, db_session: Session
) -> None:
    row_user = user(db_session)
    nested = db_session.begin_nested()
    challenge = EmailVerificationChallenge(
        user_id=row_user.id,
        email_at_issue=row_user.email,
        code_hash="a" * 64,
        attempt_count=0,
        expires_at=EXPIRY,
        created_at=NOW,
    )
    db_session.add(challenge)
    queue(db_session, outbox_settings, row_user.id)
    db_session.flush()
    nested.rollback()
    assert db_session.scalars(select(EmailOutboxMessage)).all() == []
    assert db_session.scalars(select(EmailVerificationChallenge)).all() == []


def test_expired_or_already_accepted_cannot_be_decrypted(
    outbox_settings: Settings, db_session: Session
) -> None:
    row_user = user(db_session)
    row = queue(db_session, outbox_settings, row_user.id)
    with pytest.raises(OutboxPayloadError):
        decrypt_outbox_email(row=row, settings=outbox_settings, now=EXPIRY)
    row.status = "accepted"
    with pytest.raises(OutboxPayloadError):
        decrypt_outbox_email(row=row, settings=outbox_settings, now=NOW)


def test_tampered_ciphertext_and_wrong_key_fail_closed(
    outbox_settings: Settings, db_session: Session
) -> None:
    row_user = user(db_session)
    row = queue(db_session, outbox_settings, row_user.id)
    other_settings = outbox_settings.model_copy(
        update={"email_outbox_encryption_key": SecretStr(Fernet.generate_key().decode())}
    )
    with pytest.raises(OutboxPayloadError):
        decrypt_outbox_email(row=row, settings=other_settings, now=NOW)
    row.encrypted_payload = row.encrypted_payload[:-1] + b"!"
    with pytest.raises(OutboxPayloadError):
        decrypt_outbox_email(row=row, settings=outbox_settings, now=NOW)


def test_reject_bad_key_and_non_distinct_key(test_settings: Settings, db_session: Session) -> None:
    row_user = user(db_session)
    bad = test_settings.model_copy(update={"email_outbox_encryption_key": SecretStr("not-a-key")})
    with pytest.raises(OutboxConfigurationError, match="Invalid"):
        queue(db_session, bad, row_user.id)
    same = test_settings.model_copy(
        update={"email_outbox_encryption_key": test_settings.auth_jwt_secret}
    )
    with pytest.raises(OutboxConfigurationError, match="independent"):
        queue(db_session, same, row_user.id)


@pytest.mark.parametrize(
    "expiry",
    [NOW, NOW - timedelta(seconds=1), datetime(2026, 10, 29, 20, 10), NOW + timedelta(minutes=11)],
)
def test_invalid_expiry_rejected(
    expiry: datetime, outbox_settings: Settings, db_session: Session
) -> None:
    row_user = user(db_session)
    with pytest.raises(ValueError, match="expiration"):
        enqueue_outbox_email(
            db_session=db_session,
            user_id=row_user.id,
            purpose="email_verification",
            message=MESSAGE,
            expires_at=expiry,
            settings=outbox_settings,
            now=NOW,
        )


def test_reject_invalid_purpose_and_headers(outbox_settings: Settings, db_session: Session) -> None:
    row_user = user(db_session)
    with pytest.raises(ValueError, match="purpose"):
        enqueue_outbox_email(
            db_session=db_session,
            user_id=row_user.id,
            purpose=cast(OutboxPurpose, "other"),
            message=MESSAGE,
            expires_at=EXPIRY,
            settings=outbox_settings,
            now=NOW,
        )
    with pytest.raises(ValueError, match="Invalid transactional"):
        enqueue_outbox_email(
            db_session=db_session,
            user_id=row_user.id,
            purpose="password_recovery",
            message=OutboundEmail(
                recipient="a@example.com\nBcc:b@example.com", subject="Subject", text_body="Code"
            ),
            expires_at=EXPIRY,
            settings=outbox_settings,
            now=NOW,
        )


def test_wrong_key_version_fails_closed(outbox_settings: Settings, db_session: Session) -> None:
    row_user = user(db_session)
    row = queue(db_session, outbox_settings, row_user.id)
    row.key_version = 2
    with pytest.raises(OutboxPayloadError):
        decrypt_outbox_email(row=row, settings=outbox_settings, now=NOW)
