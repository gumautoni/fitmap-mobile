from collections.abc import Iterator
from uuid import uuid4

import pytest
from pydantic import ValidationError
from sqlalchemy import Engine
from sqlalchemy.orm import Session

from fitmap.identity.accounts import (
    authenticate_user,
    create_user,
    find_user_by_email,
    normalize_email,
)
from fitmap.identity.schemas import LoginRequest, RegisterRequest
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


def test_register_request_normalizes_name_and_accepts_15_character_password() -> None:
    request = RegisterRequest(
        name="  Ana    Silva  ",
        email="Ana.Silva@Example.COM",
        password="123456789012345",
    )

    assert request.name == "Ana Silva"
    assert str(request.email) == "Ana.Silva@example.com"


def test_register_request_rejects_blank_name() -> None:
    with pytest.raises(ValidationError):
        RegisterRequest(
            name="   ",
            email="user@example.com",
            password="123456789012345",
        )


def test_register_request_rejects_password_shorter_than_15_characters() -> None:
    with pytest.raises(ValidationError):
        RegisterRequest(
            name="FitMap User",
            email="user@example.com",
            password="12345678901234",
        )


def test_login_request_accepts_password_without_registration_length_requirement() -> None:
    request = LoginRequest(
        email="user@example.com",
        password="short",
    )

    assert request.password == "short"


def test_normalize_email_is_case_insensitive_and_trims_whitespace() -> None:
    assert normalize_email("  USER@Example.COM  ") == "user@example.com"


def test_create_user_normalizes_email_and_hashes_password(
    db_session: Session,
) -> None:
    password = "123456789012345"
    email = f"USER-{uuid4()}@Example.COM"

    user = create_user(
        db_session=db_session,
        name="FitMap User",
        email=email,
        password=password,
    )

    assert user.email == email.strip().casefold()
    assert user.password_hash != password
    assert user.password_hash.startswith("$argon2id$")
    assert verify_password(password, user.password_hash) is True
    assert user.is_active is True


def test_find_user_by_email_uses_normalized_identity(
    db_session: Session,
) -> None:
    unique_part = uuid4()
    stored_email = f"user-{unique_part}@example.com"

    user = create_user(
        db_session=db_session,
        name="FitMap User",
        email=stored_email,
        password="123456789012345",
    )

    found = find_user_by_email(
        db_session=db_session,
        email=stored_email.upper(),
    )

    assert found is not None
    assert found.id == user.id


def test_authenticate_user_returns_active_user_for_valid_credentials(
    db_session: Session,
) -> None:
    unique_part = uuid4()
    email = f"user-{unique_part}@example.com"
    password = "123456789012345"

    user = create_user(
        db_session=db_session,
        name="FitMap User",
        email=email,
        password=password,
    )

    authenticated = authenticate_user(
        db_session=db_session,
        email=email.upper(),
        password=password,
    )

    assert authenticated is not None
    assert authenticated.id == user.id


def test_authenticate_user_rejects_invalid_password(
    db_session: Session,
) -> None:
    email = f"user-{uuid4()}@example.com"

    create_user(
        db_session=db_session,
        name="FitMap User",
        email=email,
        password="123456789012345",
    )

    authenticated = authenticate_user(
        db_session=db_session,
        email=email,
        password="incorrect-password",
    )

    assert authenticated is None


def test_authenticate_user_rejects_unknown_email(
    db_session: Session,
) -> None:
    authenticated = authenticate_user(
        db_session=db_session,
        email=f"missing-{uuid4()}@example.com",
        password="123456789012345",
    )

    assert authenticated is None


def test_authenticate_user_rejects_inactive_account(
    db_session: Session,
) -> None:
    email = f"user-{uuid4()}@example.com"
    password = "123456789012345"

    user = create_user(
        db_session=db_session,
        name="FitMap User",
        email=email,
        password=password,
    )
    user.is_active = False
    db_session.flush()

    authenticated = authenticate_user(
        db_session=db_session,
        email=email,
        password=password,
    )

    assert authenticated is None
