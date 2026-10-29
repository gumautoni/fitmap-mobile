"""Transactional code issuance. No network requests or real provider are used."""

from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from cryptography.fernet import Fernet
from pydantic import SecretStr
from sqlalchemy import Engine, select
from sqlalchemy.orm import Session

from fitmap.config import Settings
from fitmap.identity.accounts import create_user
from fitmap.identity.email_issuance import (
    EnqueueStatus,
    queue_email_verification,
    queue_password_recovery,
)
from fitmap.identity.email_verification import hash_email_verification_code
from fitmap.identity.models import User
from fitmap.identity.password_recovery import hash_recovery_code
from fitmap.identity.recovery_models import PasswordRecoveryChallenge
from fitmap.identity.verification_models import EmailVerificationChallenge
from fitmap.notifications.outbox import OutboxConfigurationError, decrypt_outbox_email
from fitmap.notifications.outbox_models import EmailOutboxMessage

NOW = datetime(2026, 10, 29, 20, 0, tzinfo=UTC)


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
def mail_settings(test_settings: Settings) -> Settings:
    return test_settings.model_copy(
        update={
            "auth_recovery_code_secret": SecretStr("independent-recovery-key-for-tests-123456789"),
            "auth_email_verification_secret": SecretStr(
                "independent-verification-key-for-tests-123456789"
            ),
            "email_outbox_encryption_key": SecretStr(Fernet.generate_key().decode()),
        }
    )


def make_user(db_session: Session, *, verified: bool = False) -> User:
    user = create_user(
        db_session=db_session,
        name="Email Queue Test",
        email=f"queue-{uuid4()}@example.com",
        password="OldPassword1!",
    )
    if verified:
        user.email_verified_at = NOW - timedelta(days=1)
    db_session.flush()
    return user


def outbox_rows(db_session: Session, user: User) -> list[EmailOutboxMessage]:
    return list(
        db_session.scalars(
            select(EmailOutboxMessage).where(EmailOutboxMessage.user_id == user.id)
        ).all()
    )


def test_queue_verification_stores_ciphertext_and_valid_hmac(
    db_session: Session, mail_settings: Settings
) -> None:
    user = make_user(db_session)
    result = queue_email_verification(
        db_session=db_session,
        authenticated_user_id=user.id,
        settings=mail_settings,
        now=NOW,
    )
    assert result is EnqueueStatus.QUEUED
    rows = outbox_rows(db_session, user)
    assert len(rows) == 1 and rows[0].purpose == "email_verification"
    message = decrypt_outbox_email(row=rows[0], settings=mail_settings, now=NOW)
    assert message.recipient == user.email
    code = next(
        line.removeprefix("Código de verificação: ")
        for line in message.text_body.splitlines()
        if line.startswith("Código de verificação: ")
    )
    challenge = db_session.scalar(
        select(EmailVerificationChallenge).where(EmailVerificationChallenge.user_id == user.id)
    )
    assert challenge is not None
    assert challenge.code_hash == hash_email_verification_code(
        challenge_id=challenge.id, code=code, settings=mail_settings
    )
    assert code.encode() not in rows[0].encrypted_payload
    assert user.email.encode() not in rows[0].encrypted_payload
    assert user.email_verified_at is None


def test_queue_recovery_stores_ciphertext_and_valid_hmac(
    db_session: Session, mail_settings: Settings
) -> None:
    user = make_user(db_session, verified=True)
    assert (
        queue_password_recovery(
            db_session=db_session, user_id=user.id, settings=mail_settings, now=NOW
        )
        is EnqueueStatus.QUEUED
    )
    rows = outbox_rows(db_session, user)
    assert len(rows) == 1 and rows[0].purpose == "password_recovery"
    message = decrypt_outbox_email(row=rows[0], settings=mail_settings, now=NOW)
    code = next(
        line.removeprefix("Seu código de recuperação: ")
        for line in message.text_body.splitlines()
        if line.startswith("Seu código de recuperação: ")
    )
    challenge = db_session.scalar(
        select(PasswordRecoveryChallenge).where(PasswordRecoveryChallenge.user_id == user.id)
    )
    assert challenge is not None
    assert challenge.code_hash == hash_recovery_code(
        challenge_id=challenge.id, code=code, settings=mail_settings
    )
    assert code.encode() not in rows[0].encrypted_payload
    assert user.email.encode() not in rows[0].encrypted_payload


def test_recovery_refuses_unverified_accounts(db_session: Session, mail_settings: Settings) -> None:
    user = make_user(db_session)
    assert (
        queue_password_recovery(
            db_session=db_session, user_id=user.id, settings=mail_settings, now=NOW
        )
        is EnqueueStatus.INELIGIBLE
    )
    assert outbox_rows(db_session, user) == []


def test_verification_refuses_already_verified_accounts(
    db_session: Session, mail_settings: Settings
) -> None:
    user = make_user(db_session, verified=True)
    assert (
        queue_email_verification(
            db_session=db_session, authenticated_user_id=user.id, settings=mail_settings, now=NOW
        )
        is EnqueueStatus.INELIGIBLE
    )
    assert outbox_rows(db_session, user) == []


@pytest.mark.parametrize("purpose", ["verification", "recovery"])
def test_cooldown_creates_no_extra_outbox_rows(
    db_session: Session, mail_settings: Settings, purpose: str
) -> None:
    user = make_user(db_session, verified=purpose == "recovery")
    if purpose == "verification":
        first = queue_email_verification(
            db_session=db_session, authenticated_user_id=user.id, settings=mail_settings, now=NOW
        )
        second = queue_email_verification(
            db_session=db_session,
            authenticated_user_id=user.id,
            settings=mail_settings,
            now=NOW + timedelta(seconds=20),
        )
    else:
        first = queue_password_recovery(
            db_session=db_session, user_id=user.id, settings=mail_settings, now=NOW
        )
        second = queue_password_recovery(
            db_session=db_session,
            user_id=user.id,
            settings=mail_settings,
            now=NOW + timedelta(seconds=20),
        )
    assert first is EnqueueStatus.QUEUED
    assert second is EnqueueStatus.RATE_LIMITED
    assert len(outbox_rows(db_session, user)) == 1


@pytest.mark.parametrize("purpose", ["verification", "recovery"])
def test_missing_encryption_key_undoes_challenge_creation(
    db_session: Session, mail_settings: Settings, purpose: str
) -> None:
    user = make_user(db_session, verified=purpose == "recovery")
    broken = mail_settings.model_copy(update={"email_outbox_encryption_key": None})
    with pytest.raises(OutboxConfigurationError):
        if purpose == "verification":
            queue_email_verification(
                db_session=db_session,
                authenticated_user_id=user.id,
                settings=broken,
                now=NOW,
            )
        else:
            queue_password_recovery(
                db_session=db_session, user_id=user.id, settings=broken, now=NOW
            )
    assert outbox_rows(db_session, user) == []
    if purpose == "verification":
        assert (
            db_session.scalars(
                select(EmailVerificationChallenge).where(
                    EmailVerificationChallenge.user_id == user.id
                )
            ).all()
            == []
        )
    else:
        assert (
            db_session.scalars(
                select(PasswordRecoveryChallenge).where(
                    PasswordRecoveryChallenge.user_id == user.id
                )
            ).all()
            == []
        )


def test_invalid_utc_time_prevents_any_issuance(
    db_session: Session, mail_settings: Settings
) -> None:
    user = make_user(db_session)
    with pytest.raises(ValueError, match="timezone-aware"):
        queue_email_verification(
            db_session=db_session,
            authenticated_user_id=user.id,
            settings=mail_settings,
            now=datetime(2026, 10, 29),
        )
    assert outbox_rows(db_session, user) == []
