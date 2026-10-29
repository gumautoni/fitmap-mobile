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

VALID_PASSWORD = "Aa1!bcde"
LEGACY_PASSWORD = "123456789012345"


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


def test_register_request_normalizes_name_and_accepts_eight_characters() -> None:
    request = RegisterRequest(
        name="  Ana    Silva  ",
        email="Ana.Silva@Example.COM",
        password=VALID_PASSWORD,
    )

    assert request.name == "Ana Silva"
    assert str(request.email) == "Ana.Silva@example.com"


def test_register_request_accepts_128_characters() -> None:
    password = "Aa1!" + "x" * 124
    assert (
        RegisterRequest(name="FitMap User", email="user@example.com", password=password).password
        == password
    )


def test_register_request_rejects_blank_name() -> None:
    with pytest.raises(ValidationError):
        RegisterRequest(
            name="   ",
            email="user@example.com",
            password=VALID_PASSWORD,
        )


@pytest.mark.parametrize(
    "invalid_password",
    [
        "Aa1!abc",  # 7 caracteres
        "Aa1!" + "x" * 125,  # 129 caracteres
        "aa1!bcde",  # sem maiúscula
        "AA1!BCDE",  # sem minúscula
        "Aa!!bcde",  # sem número
        "Aa11bcde",  # sem símbolo
        "Aa1😀bcde",  # símbolo fora do conjunto ASCII da política
    ],
)
def test_register_request_rejects_invalid_password(invalid_password: str) -> None:
    with pytest.raises(ValidationError):
        RegisterRequest(
            name="FitMap User",
            email="user@example.com",
            password=invalid_password,
        )


def test_login_request_accepts_password_without_registration_requirements() -> None:
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
    password = VALID_PASSWORD
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
        password=VALID_PASSWORD,
    )

    found = find_user_by_email(
        db_session=db_session,
        email=stored_email.upper(),
    )

    assert found is not None
    assert found.id == user.id


def test_authenticate_user_accepts_legacy_password(
    db_session: Session,
) -> None:
    unique_part = uuid4()
    email = f"user-{unique_part}@example.com"
    password = LEGACY_PASSWORD

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
        password=LEGACY_PASSWORD,
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
        password=LEGACY_PASSWORD,
    )

    assert authenticated is None


def test_authenticate_user_rejects_inactive_account(
    db_session: Session,
) -> None:
    email = f"user-{uuid4()}@example.com"
    password = LEGACY_PASSWORD

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
