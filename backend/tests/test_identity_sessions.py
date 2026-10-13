from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from sqlalchemy import Engine, select
from sqlalchemy.orm import Session

from fitmap.config import Settings
from fitmap.identity.models import AuthRefreshToken, AuthSession, User
from fitmap.identity.security import decode_access_token, hash_refresh_token
from fitmap.identity.sessions import (
    is_session_active,
    issue_session,
    revoke_session,
    rotate_refresh_token,
)


@pytest.fixture
def db_session(database_engine: Engine) -> Iterator[Session]:
    connection = database_engine.connect()
    transaction = connection.begin()
    session = Session(
        bind=connection,
        expire_on_commit=False,
    )

    try:
        yield session
    finally:
        session.close()
        if transaction.is_active:
            transaction.rollback()
        connection.close()


def _create_user(db_session: Session) -> User:
    user = User(
        name="FitMap Test User",
        email=f"{uuid4()}@fitmap.test",
        password_hash="not-used-by-session-tests",
        is_active=True,
    )
    db_session.add(user)
    db_session.flush()
    return user


def test_issue_session_persists_session_and_hashed_refresh_token(
    db_session: Session,
    test_settings: Settings,
) -> None:
    user = _create_user(db_session)
    issued_at = datetime.now(UTC).replace(microsecond=0)

    tokens = issue_session(
        db_session=db_session,
        user_id=user.id,
        settings=test_settings,
        issued_at=issued_at,
    )

    auth_session = db_session.get(
        AuthSession,
        tokens.session_id,
    )
    refresh_token = db_session.scalar(
        select(AuthRefreshToken).where(
            AuthRefreshToken.session_id == tokens.session_id,
        )
    )

    assert auth_session is not None
    assert refresh_token is not None

    assert auth_session.user_id == user.id
    assert auth_session.revoked_at is None
    assert auth_session.expires_at == issued_at + timedelta(days=30)

    assert refresh_token.token_hash == hash_refresh_token(
        tokens.refresh_token,
    )
    assert refresh_token.token_hash != tokens.refresh_token
    assert refresh_token.consumed_at is None
    assert refresh_token.revoked_at is None

    claims = decode_access_token(
        tokens.access_token,
        test_settings,
    )

    assert claims.user_id == user.id
    assert claims.session_id == tokens.session_id


def test_rotate_refresh_token_consumes_old_token_and_issues_replacement(
    db_session: Session,
    test_settings: Settings,
) -> None:
    user = _create_user(db_session)

    rotated_at = datetime.now(UTC).replace(microsecond=0)
    issued_at = rotated_at - timedelta(minutes=10)

    original = issue_session(
        db_session=db_session,
        user_id=user.id,
        settings=test_settings,
        issued_at=issued_at,
    )

    replacement = rotate_refresh_token(
        db_session=db_session,
        refresh_token=original.refresh_token,
        settings=test_settings,
        rotated_at=rotated_at,
    )

    assert replacement is not None
    assert replacement.session_id == original.session_id
    assert replacement.refresh_token != original.refresh_token

    db_session.flush()

    original_record = db_session.scalar(
        select(AuthRefreshToken).where(
            AuthRefreshToken.token_hash == hash_refresh_token(original.refresh_token),
        )
    )
    replacement_record = db_session.scalar(
        select(AuthRefreshToken).where(
            AuthRefreshToken.token_hash == hash_refresh_token(replacement.refresh_token),
        )
    )
    auth_session = db_session.get(
        AuthSession,
        original.session_id,
    )

    assert original_record is not None
    assert replacement_record is not None
    assert auth_session is not None

    assert original_record.consumed_at == rotated_at
    assert original_record.replaced_by_token_id == replacement_record.id

    assert replacement_record.consumed_at is None
    assert replacement_record.revoked_at is None

    assert auth_session.last_used_at == rotated_at
    assert auth_session.revoked_at is None

    claims = decode_access_token(
        replacement.access_token,
        test_settings,
    )

    assert claims.user_id == user.id
    assert claims.session_id == original.session_id


def test_reusing_consumed_refresh_token_revokes_entire_session(
    db_session: Session,
    test_settings: Settings,
) -> None:
    user = _create_user(db_session)
    issued_at = datetime.now(UTC).replace(microsecond=0)

    original = issue_session(
        db_session=db_session,
        user_id=user.id,
        settings=test_settings,
        issued_at=issued_at,
    )

    first_rotation = rotate_refresh_token(
        db_session=db_session,
        refresh_token=original.refresh_token,
        settings=test_settings,
        rotated_at=issued_at + timedelta(minutes=5),
    )

    assert first_rotation is not None

    reuse_detected_at = issued_at + timedelta(minutes=6)

    second_rotation = rotate_refresh_token(
        db_session=db_session,
        refresh_token=original.refresh_token,
        settings=test_settings,
        rotated_at=reuse_detected_at,
    )

    assert second_rotation is None

    db_session.flush()

    auth_session = db_session.get(
        AuthSession,
        original.session_id,
    )
    refresh_tokens = db_session.scalars(
        select(AuthRefreshToken).where(
            AuthRefreshToken.session_id == original.session_id,
        )
    ).all()

    assert auth_session is not None
    assert auth_session.revoked_at == reuse_detected_at

    assert len(refresh_tokens) == 2
    assert all(refresh_token.revoked_at == reuse_detected_at for refresh_token in refresh_tokens)

    assert (
        is_session_active(
            db_session=db_session,
            session_id=original.session_id,
            user_id=user.id,
            checked_at=reuse_detected_at,
        )
        is False
    )


def test_revoke_session_invalidates_session_and_refresh_tokens(
    db_session: Session,
    test_settings: Settings,
) -> None:
    user = _create_user(db_session)
    issued_at = datetime.now(UTC).replace(microsecond=0)

    tokens = issue_session(
        db_session=db_session,
        user_id=user.id,
        settings=test_settings,
        issued_at=issued_at,
    )

    revoked_at = issued_at + timedelta(minutes=20)

    revoked = revoke_session(
        db_session=db_session,
        session_id=tokens.session_id,
        revoked_at=revoked_at,
    )

    assert revoked is True

    db_session.flush()

    auth_session = db_session.get(
        AuthSession,
        tokens.session_id,
    )
    refresh_token = db_session.scalar(
        select(AuthRefreshToken).where(
            AuthRefreshToken.session_id == tokens.session_id,
        )
    )

    assert auth_session is not None
    assert refresh_token is not None

    assert auth_session.revoked_at == revoked_at
    assert refresh_token.revoked_at == revoked_at

    assert (
        is_session_active(
            db_session=db_session,
            session_id=tokens.session_id,
            user_id=user.id,
            checked_at=revoked_at,
        )
        is False
    )


def test_session_activity_checks_identity_and_expiration(
    db_session: Session,
    test_settings: Settings,
) -> None:
    user = _create_user(db_session)
    issued_at = datetime.now(UTC).replace(microsecond=0)

    tokens = issue_session(
        db_session=db_session,
        user_id=user.id,
        settings=test_settings,
        issued_at=issued_at,
    )

    assert (
        is_session_active(
            db_session=db_session,
            session_id=tokens.session_id,
            user_id=user.id,
            checked_at=issued_at + timedelta(minutes=1),
        )
        is True
    )

    assert (
        is_session_active(
            db_session=db_session,
            session_id=tokens.session_id,
            user_id=uuid4(),
            checked_at=issued_at + timedelta(minutes=1),
        )
        is False
    )

    assert (
        is_session_active(
            db_session=db_session,
            session_id=tokens.session_id,
            user_id=user.id,
            checked_at=tokens.session_expires_at,
        )
        is False
    )

    assert (
        revoke_session(
            db_session=db_session,
            session_id=uuid4(),
            revoked_at=issued_at,
        )
        is False
    )
