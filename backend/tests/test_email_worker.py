"""Manual outbox worker tests; no Resend HTTP calls or real credentials."""

import json
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import pytest
from cryptography.fernet import Fernet
from pydantic import SecretStr
from sqlalchemy import Engine, select, update
from sqlalchemy.orm import Session, sessionmaker

from fitmap.config import Settings
from fitmap.identity.accounts import create_user
from fitmap.identity.email_issuance import EnqueueStatus, queue_email_verification
from fitmap.identity.models import User
from fitmap.identity.verification_models import EmailVerificationChallenge
from fitmap.notifications import worker
from fitmap.notifications.email import OutboundEmail
from fitmap.notifications.outbox_models import EmailOutboxMessage
from fitmap.notifications.resend import EmailDeliveryError
from fitmap.notifications.worker import (
    WorkerConfigurationError,
    dispatch_email_batch,
    inspect_outbox,
    validate_live_worker_settings,
)

NOW = datetime(2026, 11, 3, 16, 0, tzinfo=UTC)


class DbFactory:
    def __init__(self, engine: Engine) -> None:
        self.sessions: sessionmaker[Session] = sessionmaker(bind=engine, expire_on_commit=False)
        self.created_users: list[UUID] = []

    def __call__(self) -> Session:
        return self.sessions()


@pytest.fixture
def factory(database_engine: Engine) -> Iterator[DbFactory]:
    owner = DbFactory(database_engine)
    try:
        yield owner
    finally:
        with owner.sessions.begin() as db_session:
            for identifier in owner.created_users:
                user = db_session.get(User, identifier)
                if user is not None:
                    db_session.delete(user)


@pytest.fixture
def dispatch_settings(test_settings: Settings) -> Settings:
    return test_settings.model_copy(
        update={
            "auth_email_verification_secret": SecretStr(
                "test-worker-verification-secret-isolated-123456"
            ),
            "email_outbox_encryption_key": SecretStr(Fernet.generate_key().decode()),
        }
    )


class FakeSender:
    def __init__(self, *, failures: int = 0) -> None:
        self.calls: list[tuple[OutboundEmail, str]] = []
        self.failures = failures

    def send(self, message: OutboundEmail, *, idempotency_key: str) -> None:
        self.calls.append((message, idempotency_key))
        if self.failures > 0:
            self.failures -= 1
            raise EmailDeliveryError(retryable=True)


def stage(factory: DbFactory, settings: Settings) -> tuple[UUID, UUID]:
    with factory.sessions.begin() as db_session:
        user = create_user(
            db_session=db_session,
            name="Manual Worker Test",
            email=f"worker-{uuid4()}@example.com",
            password="OldPassword1!",
        )
        factory.created_users.append(user.id)
        status = queue_email_verification(
            db_session=db_session,
            authenticated_user_id=user.id,
            settings=settings,
            now=NOW,
        )
        assert status is EnqueueStatus.QUEUED
        row = db_session.scalar(
            select(EmailOutboxMessage).where(EmailOutboxMessage.user_id == user.id)
        )
        assert row is not None
        return user.id, row.id


def get_row(factory: DbFactory, identifier: UUID) -> EmailOutboxMessage:
    with factory() as db_session:
        row = db_session.get(EmailOutboxMessage, identifier)
        assert row is not None
        db_session.expunge(row)
    return row


def live_settings(test_settings: Settings) -> Settings:
    return test_settings.model_copy(
        update={
            "environment": "staging",
            "email_worker_enabled": True,
            "email_provider": "resend",
            "resend_api_key": SecretStr("re_worker_test_key_never_real_123456"),
            "email_from_address": "notifications@fitmap.example",
            "auth_recovery_code_secret": SecretStr("worker-recovery-secret-independent-123456"),
            "auth_email_verification_secret": SecretStr(
                "worker-verification-secret-independent-123456"
            ),
            "email_outbox_encryption_key": SecretStr(Fernet.generate_key().decode()),
        }
    )


def test_snapshot_reads_only_aggregate_counts(
    factory: DbFactory, dispatch_settings: Settings
) -> None:
    before = inspect_outbox(session_factory=factory)
    _user, identifier = stage(factory, dispatch_settings)
    after = inspect_outbox(session_factory=factory)
    assert after.pending == before.pending + 1
    assert after.accepted == before.accepted
    assert get_row(factory, identifier).encrypted_payload
    assert not hasattr(after, "recipient")


def test_batch_dispatch_accepts_one_and_scrubs_ciphertext(
    factory: DbFactory, dispatch_settings: Settings
) -> None:
    _user, identifier = stage(factory, dispatch_settings)
    sender = FakeSender()
    summary = dispatch_email_batch(
        session_factory=factory, settings=dispatch_settings, transport=sender, now=NOW
    )
    assert summary.processed == summary.accepted == 1
    assert summary.failed == summary.discarded == summary.retry_scheduled == 0
    assert len(sender.calls) == 1
    row = get_row(factory, identifier)
    assert row.status == "accepted"
    assert row.encrypted_payload == b""
    assert sender.calls[0][1] == row.idempotency_key


def test_batch_bound_leaves_second_message_pending(
    factory: DbFactory, dispatch_settings: Settings
) -> None:
    _, first = stage(factory, dispatch_settings)
    _, second = stage(factory, dispatch_settings)
    sender = FakeSender()
    summary = dispatch_email_batch(
        session_factory=factory,
        settings=dispatch_settings,
        transport=sender,
        max_messages=1,
        now=NOW,
    )
    assert summary.processed == 1
    assert sorted([get_row(factory, first).status, get_row(factory, second).status]) == [
        "accepted",
        "pending",
    ]
    assert len(sender.calls) == 1


def test_batch_dispatches_two_distinct_accounts(
    factory: DbFactory, dispatch_settings: Settings
) -> None:
    _, first = stage(factory, dispatch_settings)
    _, second = stage(factory, dispatch_settings)
    sender = FakeSender()
    summary = dispatch_email_batch(
        session_factory=factory,
        settings=dispatch_settings,
        transport=sender,
        max_messages=2,
        now=NOW,
    )
    assert summary.accepted == summary.processed == 2
    assert len(sender.calls) == 2
    assert get_row(factory, first).status == get_row(factory, second).status == "accepted"


def test_retry_is_deferred_and_reuses_original_payload_and_key(
    factory: DbFactory, dispatch_settings: Settings
) -> None:
    _, identifier = stage(factory, dispatch_settings)
    sender = FakeSender(failures=1)
    first = dispatch_email_batch(
        session_factory=factory,
        settings=dispatch_settings,
        transport=sender,
        max_messages=3,
        now=NOW,
    )
    assert first.processed == first.retry_scheduled == 1
    assert first.idle
    assert get_row(factory, identifier).status == "pending"
    assert get_row(factory, identifier).next_attempt_at == NOW + timedelta(seconds=15)
    assert len(sender.calls) == 1

    later = dispatch_email_batch(
        session_factory=factory,
        settings=dispatch_settings,
        transport=sender,
        now=NOW + timedelta(seconds=15),
    )
    assert later.accepted == 1
    assert get_row(factory, identifier).encrypted_payload == b""
    assert sender.calls[0] == sender.calls[1]


def test_invalidated_challenge_does_not_reach_transport(
    factory: DbFactory, dispatch_settings: Settings
) -> None:
    user_id, identifier = stage(factory, dispatch_settings)
    with factory.sessions.begin() as db_session:
        db_session.execute(
            update(EmailVerificationChallenge)
            .where(EmailVerificationChallenge.user_id == user_id)
            .values(consumed_at=NOW)
        )
    sender = FakeSender()
    summary = dispatch_email_batch(
        session_factory=factory, settings=dispatch_settings, transport=sender, now=NOW
    )
    assert summary.discarded == 1
    assert sender.calls == []
    assert get_row(factory, identifier).encrypted_payload == b""


def test_expired_message_is_scrubbed_without_delivery(
    factory: DbFactory, dispatch_settings: Settings
) -> None:
    _, identifier = stage(factory, dispatch_settings)
    sender = FakeSender()
    summary = dispatch_email_batch(
        session_factory=factory,
        settings=dispatch_settings,
        transport=sender,
        now=NOW + timedelta(minutes=10),
    )
    assert summary.processed == 0
    assert summary.idle
    row = get_row(factory, identifier)
    assert row.status == "expired"
    assert row.encrypted_payload == b""
    assert sender.calls == []


@pytest.mark.parametrize("limit", [0, -1, 26])
def test_worker_rejects_unbounded_batch_without_db(
    limit: int, factory: DbFactory, dispatch_settings: Settings
) -> None:
    with pytest.raises(ValueError, match="batch size"):
        dispatch_email_batch(
            session_factory=factory,
            settings=dispatch_settings,
            transport=FakeSender(),
            max_messages=limit,
        )


def test_worker_rejects_naive_timestamp(factory: DbFactory, dispatch_settings: Settings) -> None:
    with pytest.raises(ValueError, match="timezone-aware"):
        dispatch_email_batch(
            session_factory=factory,
            settings=dispatch_settings,
            transport=FakeSender(),
            now=datetime(2026, 11, 3),
        )


def test_live_worker_disabled_by_default(test_settings: Settings) -> None:
    with pytest.raises(WorkerConfigurationError, match="disabled"):
        validate_live_worker_settings(test_settings)


def test_live_worker_refuses_test_environment(test_settings: Settings) -> None:
    staging = live_settings(test_settings)
    test = staging.model_copy(update={"environment": "test"})
    with pytest.raises(WorkerConfigurationError, match="disabled"):
        validate_live_worker_settings(test)


def test_live_worker_refuses_missing_or_reused_secret(test_settings: Settings) -> None:
    staging = live_settings(test_settings)
    with pytest.raises(WorkerConfigurationError, match="not configured"):
        validate_live_worker_settings(
            staging.model_copy(update={"auth_email_verification_secret": None})
        )
    with pytest.raises(WorkerConfigurationError, match="independent"):
        validate_live_worker_settings(
            staging.model_copy(
                update={"auth_recovery_code_secret": staging.auth_email_verification_secret}
            )
        )


def test_live_worker_configuration_validation_is_offline(test_settings: Settings) -> None:
    # Validation alone creates no provider, database session or HTTP request.
    validate_live_worker_settings(live_settings(test_settings))


def test_cli_default_status_never_constructs_provider(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
    factory: DbFactory,
    dispatch_settings: Settings,
) -> None:
    _, identifier = stage(factory, dispatch_settings)
    monkeypatch.setattr(worker, "get_settings", lambda: dispatch_settings)
    monkeypatch.setattr(worker, "_open_sessions", lambda: factory)

    def must_not_send(_settings: Settings) -> None:
        raise AssertionError("No provider in inspection mode")

    monkeypatch.setattr(worker, "create_resend_transport", must_not_send)
    assert worker.main([]) == 0
    output = json.loads(capsys.readouterr().out)
    assert set(output) == {"pending", "processing", "accepted", "failed", "expired"}
    assert output["pending"] >= 1
    assert get_row(factory, identifier).status == "pending"
    assert get_row(factory, identifier).encrypted_payload


def test_cli_execute_requires_exact_confirmation_before_loading_config(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def forbidden() -> None:
        raise AssertionError("Configuration must not load without confirmation")

    monkeypatch.setattr(worker, "get_settings", forbidden)
    assert worker.main(["--execute"]) == 2
    assert worker.main(["--execute", "--confirm-send", "wrong"]) == 2


def test_cli_rejects_send_when_worker_flag_is_off(
    monkeypatch: pytest.MonkeyPatch, test_settings: Settings
) -> None:
    monkeypatch.setattr(worker, "get_settings", lambda: test_settings)

    def forbidden_sessions() -> None:
        raise AssertionError("Database must not open for disabled live worker")

    monkeypatch.setattr(worker, "_open_sessions", forbidden_sessions)
    assert worker.main(["--execute", "--confirm-send", "SEND_REAL_EMAILS"]) == 1


@pytest.mark.parametrize("limit", ["0", "26"])
def test_cli_rejects_out_of_bounds_limit(limit: str) -> None:
    with pytest.raises(SystemExit) as exc:
        worker.main(["--max-messages", limit])
    assert exc.value.code == 2
