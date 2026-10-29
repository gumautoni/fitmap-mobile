"""Recovery foundation contract/integration tests; HTTP endpoints are not enabled yet."""

from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr, ValidationError
from sqlalchemy import Engine, select
from sqlalchemy.orm import Session

from fitmap.config import Settings
from fitmap.identity.accounts import create_user
from fitmap.identity.models import AuthRefreshToken, AuthSession, User
from fitmap.identity.password_recovery import (
    IssueStatus,
    ResetStatus,
    generate_recovery_code,
    hash_recovery_code,
    issue_recovery_code,
    reset_password_with_code,
)
from fitmap.identity.recovery_models import PasswordRecoveryChallenge
from fitmap.identity.schemas import (
    PasswordRecoveryRequest,
    PasswordRecoveryResetRequest,
)
from fitmap.identity.security import verify_password
from fitmap.identity.sessions import issue_session

NOW = datetime(2026, 10, 29, 15, 0, tzinfo=UTC)
VALID_PASSWORD = "NewPassword1!"


class CapturingSender:
    def __init__(self) -> None:
        self.messages: list[tuple[str, str, datetime]] = []

    def send_recovery_code(self, *, email: str, code: str, expires_at: datetime) -> None:
        self.messages.append((email, code, expires_at))


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
def recovery_settings(test_settings: Settings) -> Settings:
    return test_settings.model_copy(
        update={
            "auth_recovery_code_secret": SecretStr(
                "test-recovery-only-secret-not-production-1234567"
            )
        }
    )


def make_user(db_session: Session, *, verified: bool = True) -> User:
    user = create_user(
        db_session=db_session,
        name="Recovery User",
        email=f"recovery-{uuid4()}@example.com",
        password="OldPassword1!",
    )
    if verified:
        user.email_verified_at = NOW - timedelta(days=1)
    db_session.flush()
    return user


def test_recovery_request_and_reset_schemas() -> None:
    request = PasswordRecoveryRequest(email="fit@example.com")
    assert request.email == "fit@example.com"

    reset = PasswordRecoveryResetRequest(
        email="fit@example.com",
        code="001234",
        password=VALID_PASSWORD,
        confirm_password=VALID_PASSWORD,
    )
    assert reset.code == "001234"


@pytest.mark.parametrize(
    ("code", "password", "confirmation"),
    [
        ("12345", VALID_PASSWORD, VALID_PASSWORD),
        ("1234567", VALID_PASSWORD, VALID_PASSWORD),
        ("ABC123", VALID_PASSWORD, VALID_PASSWORD),
        ("\uff11\uff12\uff13\uff14\uff15\uff16", VALID_PASSWORD, VALID_PASSWORD),
        ("123456", "old", "old"),
        ("123456", "lowercase1!", "lowercase1!"),
        ("123456", VALID_PASSWORD, "DifferentPassword1!"),
    ],
)
def test_recovery_schema_rejects_invalid_input(code: str, password: str, confirmation: str) -> None:
    with pytest.raises(ValidationError):
        PasswordRecoveryResetRequest(
            email="fit@example.com", code=code, password=password, confirm_password=confirmation
        )


def test_generated_code_is_six_digits_and_keyed_hash_is_context_bound(
    recovery_settings: Settings,
) -> None:
    code = generate_recovery_code(now=NOW)
    another = generate_recovery_code(now=NOW)
    assert len(code.value) == 6
    assert code.value.isascii() and code.value.isdecimal()
    assert code.expires_at == NOW + timedelta(minutes=10)
    digest = hash_recovery_code(
        challenge_id=code.challenge_id, code=code.value, settings=recovery_settings
    )
    assert len(digest) == 64
    assert code.value not in digest
    assert digest != hash_recovery_code(
        challenge_id=another.challenge_id, code=code.value, settings=recovery_settings
    )
    assert "value" not in repr(code)


def test_unverified_user_cannot_receive_or_use_recovery(
    db_session: Session, recovery_settings: Settings
) -> None:
    user = make_user(db_session, verified=False)
    sender = CapturingSender()
    result = issue_recovery_code(
        db_session=db_session,
        user_id=user.id,
        sender=sender,
        settings=recovery_settings,
        now=NOW,
    )
    assert result is IssueStatus.INELIGIBLE
    assert sender.messages == []
    assert (
        reset_password_with_code(
            db_session=db_session,
            email=user.email,
            code="123456",
            new_password=VALID_PASSWORD,
            settings=recovery_settings,
            now=NOW,
        )
        is ResetStatus.INVALID
    )


def test_issue_cooldown_hourly_limit_and_invalidates_previous(
    db_session: Session, recovery_settings: Settings
) -> None:
    user = make_user(db_session)
    sender = CapturingSender()

    def issue(seconds: int) -> IssueStatus:
        return issue_recovery_code(
            db_session=db_session,
            user_id=user.id,
            sender=sender,
            settings=recovery_settings,
            now=NOW + timedelta(seconds=seconds),
        )

    assert issue(0) is IssueStatus.SENT
    assert issue(30) is IssueStatus.RATE_LIMITED
    assert issue(61) is IssueStatus.SENT
    assert issue(122) is IssueStatus.SENT
    assert issue(183) is IssueStatus.RATE_LIMITED
    assert len(sender.messages) == 3
    persisted = db_session.scalars(
        select(PasswordRecoveryChallenge).where(PasswordRecoveryChallenge.user_id == user.id)
    ).all()
    assert len(persisted) == 3
    assert sum(challenge.consumed_at is None for challenge in persisted) == 1
    assert all(len(challenge.code_hash) == 64 for challenge in persisted)
    assert all(sender.messages[0][1] != challenge.code_hash for challenge in persisted)


def test_five_failed_attempts_exhaust_code(
    db_session: Session, recovery_settings: Settings
) -> None:
    user = make_user(db_session)
    sender = CapturingSender()
    assert (
        issue_recovery_code(
            db_session=db_session,
            user_id=user.id,
            sender=sender,
            settings=recovery_settings,
            now=NOW,
        )
        is IssueStatus.SENT
    )
    valid_code = sender.messages[0][1]

    for attempt in range(5):
        wrong = f"{(int(valid_code) + attempt + 1) % 1_000_000:06d}"
        assert (
            reset_password_with_code(
                db_session=db_session,
                email=user.email,
                code=wrong,
                new_password=VALID_PASSWORD,
                settings=recovery_settings,
                now=NOW + timedelta(seconds=attempt + 1),
            )
            is ResetStatus.INVALID
        )

    assert (
        reset_password_with_code(
            db_session=db_session,
            email=user.email,
            code=valid_code,
            new_password=VALID_PASSWORD,
            settings=recovery_settings,
            now=NOW + timedelta(seconds=7),
        )
        is ResetStatus.INVALID
    )
    challenge = db_session.scalar(
        select(PasswordRecoveryChallenge).where(PasswordRecoveryChallenge.user_id == user.id)
    )
    assert challenge is not None
    assert challenge.attempt_count == 5
    assert challenge.consumed_at is not None
    assert verify_password("OldPassword1!", user.password_hash)


def test_expired_code_is_invalid(db_session: Session, recovery_settings: Settings) -> None:
    user = make_user(db_session)
    sender = CapturingSender()
    assert (
        issue_recovery_code(
            db_session=db_session,
            user_id=user.id,
            sender=sender,
            settings=recovery_settings,
            now=NOW,
        )
        is IssueStatus.SENT
    )
    assert (
        reset_password_with_code(
            db_session=db_session,
            email=user.email,
            code=sender.messages[0][1],
            new_password=VALID_PASSWORD,
            settings=recovery_settings,
            now=NOW + timedelta(minutes=10),
        )
        is ResetStatus.INVALID
    )
    assert verify_password("OldPassword1!", user.password_hash)


def test_success_changes_password_revokes_all_sessions_and_prevents_reuse(
    db_session: Session, recovery_settings: Settings
) -> None:
    user = make_user(db_session)
    first_session = issue_session(
        db_session=db_session, user_id=user.id, settings=recovery_settings, issued_at=NOW
    )
    second_session = issue_session(
        db_session=db_session, user_id=user.id, settings=recovery_settings, issued_at=NOW
    )
    sender = CapturingSender()
    assert (
        issue_recovery_code(
            db_session=db_session,
            user_id=user.id,
            sender=sender,
            settings=recovery_settings,
            now=NOW,
        )
        is IssueStatus.SENT
    )
    code = sender.messages[0][1]

    assert (
        reset_password_with_code(
            db_session=db_session,
            email=user.email.upper(),
            code=code,
            new_password=VALID_PASSWORD,
            settings=recovery_settings,
            now=NOW + timedelta(minutes=1),
        )
        is ResetStatus.RESET
    )
    assert verify_password(VALID_PASSWORD, user.password_hash)
    assert not verify_password("OldPassword1!", user.password_hash)
    assert (
        reset_password_with_code(
            db_session=db_session,
            email=user.email,
            code=code,
            new_password="AnotherValid2!",
            settings=recovery_settings,
            now=NOW + timedelta(minutes=2),
        )
        is ResetStatus.INVALID
    )

    sessions = db_session.scalars(select(AuthSession).where(AuthSession.user_id == user.id)).all()
    assert {session.id for session in sessions} == {
        first_session.session_id,
        second_session.session_id,
    }
    assert all(session.revoked_at is not None for session in sessions)
    refresh_tokens = db_session.scalars(
        select(AuthRefreshToken).where(
            AuthRefreshToken.session_id.in_([first_session.session_id, second_session.session_id])
        )
    ).all()
    assert len(refresh_tokens) == 2
    assert all(token.revoked_at is not None for token in refresh_tokens)


def test_missing_or_reused_secret_fails_closed(
    db_session: Session, test_settings: Settings
) -> None:
    user = make_user(db_session)
    with pytest.raises(RuntimeError, match="recovery-code secret"):
        issue_recovery_code(
            db_session=db_session,
            user_id=user.id,
            sender=CapturingSender(),
            settings=test_settings,
            now=NOW,
        )


def test_reusing_jwt_secret_is_rejected(test_settings: Settings) -> None:
    reused = test_settings.model_copy(
        update={"auth_recovery_code_secret": test_settings.auth_jwt_secret}
    )
    with pytest.raises(RuntimeError, match="must be distinct"):
        hash_recovery_code(challenge_id=uuid4(), code="012345", settings=reused)


def test_recovery_http_routes_are_not_exposed_yet(client: TestClient) -> None:
    response = client.get("/openapi.json")
    assert response.status_code == 200
    paths = response.json()["paths"]
    assert "/api/v1/auth/password-recovery/request" not in paths
    assert "/api/v1/auth/password-recovery/reset" not in paths
