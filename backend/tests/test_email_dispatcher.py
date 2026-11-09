"""PostgreSQL integration: explicit outbox dispatch, no provider/network/scheduler."""

from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import pytest
from cryptography.fernet import Fernet
from pydantic import SecretStr
from sqlalchemy import Engine, update
from sqlalchemy.orm import Session, sessionmaker

from fitmap.config import Settings
from fitmap.identity.accounts import create_user
from fitmap.identity.email_verification import issue_email_verification
from fitmap.identity.models import User
from fitmap.identity.verification_models import EmailVerificationChallenge
from fitmap.notifications.dispatcher import DispatchOutcome, dispatch_one_email
from fitmap.notifications.email import OutboundEmail
from fitmap.notifications.outbox import OutboxConfigurationError, enqueue_outbox_email
from fitmap.notifications.outbox_models import EmailOutboxMessage
from fitmap.notifications.resend import EmailDeliveryError
from fitmap.notifications.verification import build_email_verification_message

NOW = datetime(2026, 10, 29, 21, 0, tzinfo=UTC)


class DbFactory:
    def __init__(self, engine: Engine) -> None:
        self.sessions: sessionmaker[Session] = sessionmaker(bind=engine, expire_on_commit=False)
        self.created_user_ids: list[UUID] = []

    def __call__(self) -> Session:
        return self.sessions()


@pytest.fixture
def factory(database_engine: Engine) -> Iterator[DbFactory]:
    owner = DbFactory(database_engine)
    yield owner
    with owner.sessions.begin() as db_session:
        for identifier in owner.created_user_ids:
            account = db_session.get(User, identifier)
            if account is not None:
                db_session.delete(account)


@pytest.fixture
def dispatch_settings(test_settings: Settings) -> Settings:
    return test_settings.model_copy(
        update={
            "email_outbox_encryption_key": SecretStr(Fernet.generate_key().decode()),
            "auth_email_verification_secret": SecretStr(
                "test-email-verification-secret-for-dispatch-12345"
            ),
        }
    )


class FakeSender:
    def __init__(self, *, failures: list[bool] | None = None) -> None:
        self.calls: list[tuple[OutboundEmail, str]] = []
        self.failures = failures or []

    def send(self, message: OutboundEmail, *, idempotency_key: str) -> None:
        self.calls.append((message, idempotency_key))
        if self.failures and self.failures.pop(0):
            raise EmailDeliveryError(retryable=True)


def staged(factory: DbFactory, settings: Settings) -> tuple[UUID, UUID]:
    with factory.sessions.begin() as session:
        account = create_user(
            db_session=session,
            name="Dispatcher Test",
            email=f"dispatcher-{uuid4()}@example.com",
            password="OldPassword1!",
        )
        session.flush()
        factory.created_user_ids.append(account.id)
        result = issue_email_verification(
            db_session=session,
            authenticated_user_id=account.id,
            settings=settings,
            now=NOW,
        )
        assert result.material is not None
        outbound = build_email_verification_message(
            recipient=result.material.recipient,
            code=result.material.code,
            expires_at=result.material.expires_at,
        )
        row = enqueue_outbox_email(
            db_session=session,
            user_id=account.id,
            purpose="email_verification",
            message=outbound,
            expires_at=result.material.expires_at,
            settings=settings,
            now=NOW,
        )
        row_id = row.id
        user_id = account.id
    return user_id, row_id


def row_status(factory: DbFactory, row_id: UUID) -> EmailOutboxMessage:
    with factory() as db_session:
        row = db_session.get(EmailOutboxMessage, row_id)
        assert row is not None
        db_session.expunge(row)
    return row


def test_dispatch_uses_committed_challenge_and_scrubs_success(
    factory: DbFactory, dispatch_settings: Settings
) -> None:
    _, row_id = staged(factory, dispatch_settings)

    class ObserveSender(FakeSender):
        def send(self, message: OutboundEmail, *, idempotency_key: str) -> None:
            intermediate = row_status(factory, row_id)
            assert intermediate.status == "processing"
            assert intermediate.lease_token is not None
            assert intermediate.attempt_count == 1
            super().send(message, idempotency_key=idempotency_key)

    worker = ObserveSender()
    assert (
        dispatch_one_email(
            session_factory=factory, settings=dispatch_settings, transport=worker, now=NOW
        )
        is DispatchOutcome.ACCEPTED
    )
    assert len(worker.calls) == 1
    result = row_status(factory, row_id)
    assert result.status == "accepted"
    assert result.encrypted_payload == b""
    assert result.accepted_at == NOW
    assert result.lease_token is None
    assert worker.calls[0][1] == result.idempotency_key
    assert (
        dispatch_one_email(
            session_factory=factory, settings=dispatch_settings, transport=worker, now=NOW
        )
        is DispatchOutcome.IDLE
    )


def test_retry_preserves_code_and_key_and_honors_delay(
    factory: DbFactory, dispatch_settings: Settings
) -> None:
    _, row_id = staged(factory, dispatch_settings)
    worker = FakeSender(failures=[True, True])
    assert (
        dispatch_one_email(
            session_factory=factory, settings=dispatch_settings, transport=worker, now=NOW
        )
        is DispatchOutcome.RETRY_SCHEDULED
    )
    first = row_status(factory, row_id)
    assert first.status == "pending"
    assert first.attempt_count == 1
    assert first.next_attempt_at == NOW + timedelta(seconds=15)
    assert len(worker.calls) == 1
    assert (
        dispatch_one_email(
            session_factory=factory,
            settings=dispatch_settings,
            transport=worker,
            now=NOW + timedelta(seconds=14),
        )
        is DispatchOutcome.IDLE
    )
    assert (
        dispatch_one_email(
            session_factory=factory,
            settings=dispatch_settings,
            transport=worker,
            now=NOW + timedelta(seconds=15),
        )
        is DispatchOutcome.RETRY_SCHEDULED
    )
    assert (
        dispatch_one_email(
            session_factory=factory,
            settings=dispatch_settings,
            transport=worker,
            now=NOW + timedelta(seconds=75),
        )
        is DispatchOutcome.ACCEPTED
    )
    final = row_status(factory, row_id)
    assert final.attempt_count == 3
    assert final.encrypted_payload == b""
    assert len({key for _, key in worker.calls}) == 1
    assert len({message.text_body for message, _ in worker.calls}) == 1


def test_retry_exhaustion_scrubs_payload(factory: DbFactory, dispatch_settings: Settings) -> None:
    _, row_id = staged(factory, dispatch_settings)
    worker = FakeSender(failures=[True, True, True])
    outcomes = [
        dispatch_one_email(
            session_factory=factory, settings=dispatch_settings, transport=worker, now=NOW + delta
        )
        for delta in (timedelta(), timedelta(seconds=15), timedelta(seconds=75))
    ]
    assert outcomes == [
        DispatchOutcome.RETRY_SCHEDULED,
        DispatchOutcome.RETRY_SCHEDULED,
        DispatchOutcome.FAILED,
    ]
    row = row_status(factory, row_id)
    assert row.status == "failed"
    assert row.encrypted_payload == b""


def test_expired_row_never_sends_and_scrubs_ciphertext(
    factory: DbFactory, dispatch_settings: Settings
) -> None:
    _, row_id = staged(factory, dispatch_settings)
    worker = FakeSender()
    assert (
        dispatch_one_email(
            session_factory=factory,
            settings=dispatch_settings,
            transport=worker,
            now=NOW + timedelta(minutes=10),
        )
        is DispatchOutcome.IDLE
    )
    result = row_status(factory, row_id)
    assert result.status == "expired"
    assert result.encrypted_payload == b""
    assert worker.calls == []


def test_code_invalidated_by_verification_is_never_sent(
    factory: DbFactory, dispatch_settings: Settings
) -> None:
    user_id, row_id = staged(factory, dispatch_settings)
    with factory.sessions.begin() as db_session:
        db_session.execute(
            update(EmailVerificationChallenge)
            .where(EmailVerificationChallenge.user_id == user_id)
            .values(consumed_at=NOW)
        )
    worker = FakeSender()
    assert (
        dispatch_one_email(
            session_factory=factory, settings=dispatch_settings, transport=worker, now=NOW
        )
        is DispatchOutcome.DISCARDED
    )
    row = row_status(factory, row_id)
    assert row.status == "failed"
    assert row.encrypted_payload == b""
    assert worker.calls == []


def test_active_lease_prevents_second_dispatch_until_recovery(
    factory: DbFactory, dispatch_settings: Settings
) -> None:
    _, row_id = staged(factory, dispatch_settings)
    with factory.sessions.begin() as db_session:
        row = db_session.get(EmailOutboxMessage, row_id)
        assert row is not None
        row.status = "processing"
        row.lease_token = uuid4()
        row.leased_until = NOW + timedelta(seconds=45)
        row.attempt_count = 1
    worker = FakeSender()
    assert (
        dispatch_one_email(
            session_factory=factory,
            settings=dispatch_settings,
            transport=worker,
            now=NOW + timedelta(seconds=44),
        )
        is DispatchOutcome.IDLE
    )
    assert worker.calls == []
    assert (
        dispatch_one_email(
            session_factory=factory,
            settings=dispatch_settings,
            transport=worker,
            now=NOW + timedelta(seconds=45),
        )
        is DispatchOutcome.ACCEPTED
    )
    assert row_status(factory, row_id).attempt_count == 2


def test_missing_encryption_key_fails_closed_without_send(
    factory: DbFactory, dispatch_settings: Settings
) -> None:
    _, row_id = staged(factory, dispatch_settings)
    without_key = dispatch_settings.model_copy(update={"email_outbox_encryption_key": None})
    worker = FakeSender()
    with pytest.raises(OutboxConfigurationError):
        dispatch_one_email(session_factory=factory, settings=without_key, transport=worker, now=NOW)
    assert row_status(factory, row_id).encrypted_payload != b""
    assert worker.calls == []
    assert (
        dispatch_one_email(
            session_factory=factory,
            settings=dispatch_settings,
            transport=worker,
            now=NOW + timedelta(seconds=45),
        )
        is DispatchOutcome.ACCEPTED
    )


def test_corrupted_ciphertext_fails_closed_without_send(
    factory: DbFactory, dispatch_settings: Settings
) -> None:
    _, row_id = staged(factory, dispatch_settings)
    with factory.sessions.begin() as db_session:
        row = db_session.get(EmailOutboxMessage, row_id)
        assert row is not None
        row.encrypted_payload = b"bad-ciphertext"
    worker = FakeSender()
    assert (
        dispatch_one_email(
            session_factory=factory, settings=dispatch_settings, transport=worker, now=NOW
        )
        is DispatchOutcome.DISCARDED
    )
    assert row_status(factory, row_id).encrypted_payload == b""
    assert worker.calls == []
