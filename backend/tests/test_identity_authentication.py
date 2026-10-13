from collections.abc import Iterator
from uuid import uuid4

import pytest
from sqlalchemy import Engine, func, select
from sqlalchemy.orm import Session

from fitmap.config import Settings
from fitmap.identity.authentication import (
    AccountAlreadyExistsError,
    login_user,
    register_user,
)
from fitmap.identity.models import AuthRefreshToken, AuthSession, User
from fitmap.identity.security import verify_password


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


def test_register_user_creates_account_and_authentication_session(
    db_session: Session,
    test_settings: Settings,
) -> None:
    email = f"user-{uuid4()}@example.com"
    password = "123456789012345"

    result = register_user(
        db_session=db_session,
        settings=test_settings,
        name="FitMap User",
        email=email,
        password=password,
    )

    user = db_session.get(
        User,
        result.user.id,
    )
    auth_session = db_session.get(
        AuthSession,
        result.tokens.session_id,
    )
    refresh_token_count = db_session.scalar(
        select(func.count())
        .select_from(AuthRefreshToken)
        .where(
            AuthRefreshToken.session_id == result.tokens.session_id,
        )
    )

    assert user is not None
    assert auth_session is not None

    assert user.email == email
    assert user.password_hash != password
    assert verify_password(password, user.password_hash) is True

    assert auth_session.user_id == user.id
    assert auth_session.revoked_at is None

    assert refresh_token_count == 1
    assert result.tokens.access_token
    assert result.tokens.refresh_token


def test_register_user_rejects_duplicate_normalized_email(
    db_session: Session,
    test_settings: Settings,
) -> None:
    unique_part = uuid4()
    email = f"user-{unique_part}@example.com"

    first = register_user(
        db_session=db_session,
        settings=test_settings,
        name="First User",
        email=email,
        password="123456789012345",
    )

    with pytest.raises(AccountAlreadyExistsError):
        register_user(
            db_session=db_session,
            settings=test_settings,
            name="Duplicate User",
            email=email.upper(),
            password="abcdefghijklmno",
        )

    user_count = db_session.scalar(
        select(func.count()).select_from(User).where(User.email == email),
    )
    session_count = db_session.scalar(
        select(func.count()).select_from(AuthSession).where(AuthSession.user_id == first.user.id),
    )

    assert user_count == 1
    assert session_count == 1


def test_login_user_creates_new_session_for_valid_credentials(
    db_session: Session,
    test_settings: Settings,
) -> None:
    email = f"user-{uuid4()}@example.com"
    password = "123456789012345"

    registered = register_user(
        db_session=db_session,
        settings=test_settings,
        name="FitMap User",
        email=email,
        password=password,
    )

    logged_in = login_user(
        db_session=db_session,
        settings=test_settings,
        email=email.upper(),
        password=password,
    )

    assert logged_in is not None
    assert logged_in.user.id == registered.user.id
    assert logged_in.tokens.session_id != registered.tokens.session_id

    session_count = db_session.scalar(
        select(func.count())
        .select_from(AuthSession)
        .where(AuthSession.user_id == registered.user.id),
    )

    assert session_count == 2


def test_login_user_rejects_invalid_credentials_without_creating_session(
    db_session: Session,
    test_settings: Settings,
) -> None:
    email = f"user-{uuid4()}@example.com"

    registered = register_user(
        db_session=db_session,
        settings=test_settings,
        name="FitMap User",
        email=email,
        password="123456789012345",
    )

    session_count_before = db_session.scalar(
        select(func.count())
        .select_from(AuthSession)
        .where(AuthSession.user_id == registered.user.id),
    )

    result = login_user(
        db_session=db_session,
        settings=test_settings,
        email=email,
        password="incorrect-password",
    )

    session_count_after = db_session.scalar(
        select(func.count())
        .select_from(AuthSession)
        .where(AuthSession.user_id == registered.user.id),
    )

    assert result is None
    assert session_count_before == 1
    assert session_count_after == 1


def test_login_user_rejects_unknown_account_without_creating_session(
    db_session: Session,
    test_settings: Settings,
) -> None:
    session_count_before = db_session.scalar(select(func.count()).select_from(AuthSession))

    result = login_user(
        db_session=db_session,
        settings=test_settings,
        email=f"missing-{uuid4()}@example.com",
        password="123456789012345",
    )

    session_count_after = db_session.scalar(select(func.count()).select_from(AuthSession))

    assert result is None
    assert session_count_after == session_count_before
