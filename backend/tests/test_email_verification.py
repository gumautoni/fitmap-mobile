"""Email ownership verification: domain and integration tests (no real email)."""

from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr
from sqlalchemy import Engine, select
from sqlalchemy.orm import Session

from fitmap.config import Settings
from fitmap.identity.accounts import create_user
from fitmap.identity.email_verification import (
    IssueVerificationResult,
    IssueVerificationStatus,
    VerifyEmailStatus,
    confirm_email_verification,
    hash_email_verification_code,
    issue_email_verification,
)
from fitmap.identity.models import User
from fitmap.identity.verification_models import EmailVerificationChallenge

NOW = datetime(2026, 10, 29, 18, 0, tzinfo=UTC)


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
def verification_settings(test_settings: Settings) -> Settings:
    return test_settings.model_copy(
        update={
            "auth_email_verification_secret": SecretStr(
                "test-email-verification-key-for-isolation-123456"
            ),
            "auth_recovery_code_secret": SecretStr("other-recovery-secret-only-for-tests-123456"),
        }
    )


def make_user(db_session: Session, *, active: bool = True, verified: bool = False) -> User:
    user = create_user(
        db_session=db_session,
        name="Verification User",
        email=f"verify-{uuid4()}@example.com",
        password="OldPassword1!",
    )
    user.is_active = active
    if verified:
        user.email_verified_at = NOW - timedelta(days=1)
    db_session.flush()
    return user


def issue(
    db_session: Session, settings: Settings, user: User, *, seconds: int = 0
) -> IssueVerificationResult:
    return issue_email_verification(
        db_session=db_session,
        authenticated_user_id=user.id,
        settings=settings,
        now=NOW + timedelta(seconds=seconds),
    )


def test_issue_returns_secret_material_without_marking_user_verified(
    db_session: Session, verification_settings: Settings
) -> None:
    user = make_user(db_session)
    result = issue(db_session, verification_settings, user)
    assert result.status is IssueVerificationStatus.ISSUED
    assert result.material is not None
    assert result.material.recipient == user.email
    assert len(result.material.code) == 6
    assert result.material.code.isascii() and result.material.code.isdecimal()
    assert result.material.expires_at == NOW + timedelta(minutes=10)
    assert user.email_verified_at is None
    challenge = db_session.scalar(
        select(EmailVerificationChallenge).where(EmailVerificationChallenge.user_id == user.id)
    )
    assert challenge is not None
    assert challenge.code_hash != result.material.code
    assert challenge.email_at_issue == user.email
    assert len(challenge.code_hash) == 64
    assert result.material.code not in repr(result)
    assert user.email not in repr(result)


def test_success_verifies_email_and_consumes_code(
    db_session: Session, verification_settings: Settings
) -> None:
    user = make_user(db_session)
    result = issue(db_session, verification_settings, user)
    assert result.material is not None
    assert (
        confirm_email_verification(
            db_session=db_session,
            authenticated_user_id=user.id,
            code=result.material.code,
            settings=verification_settings,
            now=NOW + timedelta(minutes=1),
        )
        is VerifyEmailStatus.VERIFIED
    )
    assert user.email_verified_at == NOW + timedelta(minutes=1)
    assert (
        confirm_email_verification(
            db_session=db_session,
            authenticated_user_id=user.id,
            code=result.material.code,
            settings=verification_settings,
            now=NOW + timedelta(minutes=2),
        )
        is VerifyEmailStatus.ALREADY_VERIFIED
    )
    challenge = db_session.scalar(
        select(EmailVerificationChallenge).where(EmailVerificationChallenge.user_id == user.id)
    )
    assert challenge is not None and challenge.consumed_at is not None


def test_only_authenticated_users_own_challenge_can_verify(
    db_session: Session, verification_settings: Settings
) -> None:
    original = make_user(db_session)
    other = make_user(db_session)
    result = issue(db_session, verification_settings, original)
    assert result.material is not None
    assert (
        confirm_email_verification(
            db_session=db_session,
            authenticated_user_id=other.id,
            code=result.material.code,
            settings=verification_settings,
            now=NOW + timedelta(minutes=1),
        )
        is VerifyEmailStatus.INVALID
    )
    assert other.email_verified_at is None
    assert original.email_verified_at is None


def test_issuance_is_ineligible_for_already_verified_and_inactive_accounts(
    db_session: Session, verification_settings: Settings
) -> None:
    verified = make_user(db_session, verified=True)
    inactive = make_user(db_session, active=False)
    assert (
        issue(db_session, verification_settings, verified).status
        is IssueVerificationStatus.INELIGIBLE
    )
    assert (
        issue(db_session, verification_settings, inactive).status
        is IssueVerificationStatus.INELIGIBLE
    )


def test_issuance_limits_and_revokes_older_codes(
    db_session: Session, verification_settings: Settings
) -> None:
    user = make_user(db_session)
    first = issue(db_session, verification_settings, user)
    assert first.material is not None
    assert (
        issue(db_session, verification_settings, user, seconds=30).status
        is IssueVerificationStatus.RATE_LIMITED
    )
    second = issue(db_session, verification_settings, user, seconds=61)
    assert second.status is IssueVerificationStatus.ISSUED
    assert (
        confirm_email_verification(
            db_session=db_session,
            authenticated_user_id=user.id,
            code=first.material.code,
            settings=verification_settings,
            now=NOW + timedelta(seconds=62),
        )
        is VerifyEmailStatus.INVALID
    )
    third = issue(db_session, verification_settings, user, seconds=122)
    assert third.status is IssueVerificationStatus.ISSUED
    assert (
        issue(db_session, verification_settings, user, seconds=183).status
        is IssueVerificationStatus.RATE_LIMITED
    )
    challenges = db_session.scalars(
        select(EmailVerificationChallenge).where(EmailVerificationChallenge.user_id == user.id)
    ).all()
    assert len(challenges) == 3
    assert sum(x.consumed_at is None for x in challenges) == 1


def test_five_wrong_codes_invalidate_latest_challenge(
    db_session: Session, verification_settings: Settings
) -> None:
    user = make_user(db_session)
    result = issue(db_session, verification_settings, user)
    assert result.material is not None
    correct = result.material.code
    for i in range(5):
        wrong = f"{(int(correct) + i + 1) % 1_000_000:06d}"
        assert (
            confirm_email_verification(
                db_session=db_session,
                authenticated_user_id=user.id,
                code=wrong,
                settings=verification_settings,
                now=NOW + timedelta(seconds=i + 1),
            )
            is VerifyEmailStatus.INVALID
        )
    assert (
        confirm_email_verification(
            db_session=db_session,
            authenticated_user_id=user.id,
            code=correct,
            settings=verification_settings,
            now=NOW + timedelta(minutes=1),
        )
        is VerifyEmailStatus.INVALID
    )
    assert user.email_verified_at is None
    challenge = db_session.scalar(
        select(EmailVerificationChallenge).where(EmailVerificationChallenge.user_id == user.id)
    )
    assert challenge is not None and challenge.attempt_count == 5
    assert challenge.consumed_at is not None


def test_expired_code_does_not_verify(db_session: Session, verification_settings: Settings) -> None:
    user = make_user(db_session)
    result = issue(db_session, verification_settings, user)
    assert result.material is not None
    assert (
        confirm_email_verification(
            db_session=db_session,
            authenticated_user_id=user.id,
            code=result.material.code,
            settings=verification_settings,
            now=NOW + timedelta(minutes=10),
        )
        is VerifyEmailStatus.INVALID
    )
    assert user.email_verified_at is None


def test_changed_account_email_cannot_be_verified_with_old_code(
    db_session: Session, verification_settings: Settings
) -> None:
    user = make_user(db_session)
    result = issue(db_session, verification_settings, user)
    assert result.material is not None
    user.email = f"new-{uuid4()}@example.com"
    db_session.flush()
    assert (
        confirm_email_verification(
            db_session=db_session,
            authenticated_user_id=user.id,
            code=result.material.code,
            settings=verification_settings,
            now=NOW + timedelta(minutes=1),
        )
        is VerifyEmailStatus.INVALID
    )
    assert user.email_verified_at is None


def test_inactive_account_cannot_confirm(
    db_session: Session, verification_settings: Settings
) -> None:
    user = make_user(db_session)
    result = issue(db_session, verification_settings, user)
    assert result.material is not None
    user.is_active = False
    db_session.flush()
    assert (
        confirm_email_verification(
            db_session=db_session,
            authenticated_user_id=user.id,
            code=result.material.code,
            settings=verification_settings,
            now=NOW + timedelta(seconds=5),
        )
        is VerifyEmailStatus.INVALID
    )


@pytest.mark.parametrize(
    "invalid_code",
    ["", "12345", "1234567", "ABCDEF", "123 56", "\uff11\uff12\uff13\uff14\uff15\uff16"],
)
def test_format_restrictions_reject_non_ascii_codes(
    db_session: Session, verification_settings: Settings, invalid_code: str
) -> None:
    user = make_user(db_session)
    assert (
        confirm_email_verification(
            db_session=db_session,
            authenticated_user_id=user.id,
            code=invalid_code,
            settings=verification_settings,
            now=NOW,
        )
        is VerifyEmailStatus.INVALID
    )


def test_hash_is_domain_separated_and_challenge_bound(verification_settings: Settings) -> None:
    first_id, second_id = uuid4(), uuid4()
    digest = hash_email_verification_code(
        challenge_id=first_id, code="001234", settings=verification_settings
    )
    assert len(digest) == 64
    assert digest != hash_email_verification_code(
        challenge_id=second_id, code="001234", settings=verification_settings
    )
    from fitmap.identity.password_recovery import hash_recovery_code

    assert digest != hash_recovery_code(
        challenge_id=first_id, code="001234", settings=verification_settings
    )


def test_missing_secret_fails_closed(db_session: Session, test_settings: Settings) -> None:
    user = make_user(db_session)
    with pytest.raises(RuntimeError, match="email-verification secret"):
        issue(db_session, test_settings, user)


def test_reused_jwt_and_recovery_keys_are_rejected(verification_settings: Settings) -> None:
    for reused in [
        verification_settings.auth_jwt_secret,
        verification_settings.auth_recovery_code_secret,
    ]:
        settings = verification_settings.model_copy(
            update={"auth_email_verification_secret": reused}
        )
        with pytest.raises(RuntimeError, match="must be distinct"):
            hash_email_verification_code(challenge_id=uuid4(), code="000001", settings=settings)


def test_unaware_time_rejected(db_session: Session, verification_settings: Settings) -> None:
    user = make_user(db_session)
    with pytest.raises(ValueError, match="timezone-aware"):
        issue_email_verification(
            db_session=db_session,
            authenticated_user_id=user.id,
            settings=verification_settings,
            now=datetime(2026, 10, 29),
        )


def test_verified_email_is_not_trusted_by_default(
    db_session: Session, verification_settings: Settings
) -> None:
    user = make_user(db_session)
    assert user.email_verified_at is None
    assert issue(db_session, verification_settings, user).status is IssueVerificationStatus.ISSUED
    assert user.email_verified_at is None


def test_verification_routes_not_published(client: TestClient) -> None:
    response = client.get("/openapi.json")
    assert response.status_code == 200
    paths = response.json()["paths"]
    assert "/api/v1/auth/email-verification/request" not in paths
    assert "/api/v1/auth/email-verification/confirm" not in paths
