from collections.abc import Iterator
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, delete, func, select

from fitmap.identity.models import AuthSession, User
from fitmap.identity.security import verify_password


@pytest.fixture
def created_emails() -> Iterator[list[str]]:
    emails: list[str] = []
    yield emails


@pytest.fixture(autouse=True)
def cleanup_created_users(
    database_engine: Engine,
    created_emails: list[str],
) -> Iterator[None]:
    yield

    if not created_emails:
        return

    with database_engine.begin() as connection:
        connection.execute(
            delete(User).where(
                User.email.in_(created_emails),
            )
        )


def test_register_creates_user_and_returns_tokens(
    client: TestClient,
    database_engine: Engine,
    created_emails: list[str],
) -> None:
    email = f"user-{uuid4()}@example.com"
    password = "123456789012345"
    created_emails.append(email)

    response = client.post(
        "/api/v1/auth/register",
        json={
            "name": "  FitMap    User  ",
            "email": email.upper(),
            "password": password,
        },
    )

    assert response.status_code == 201

    payload = response.json()

    assert payload["user"]["name"] == "FitMap User"
    assert payload["user"]["email"] == email
    assert payload["tokens"]["access_token"]
    assert payload["tokens"]["refresh_token"]
    assert payload["tokens"]["token_type"] == "bearer"

    serialized_response = response.text.lower()

    assert "password_hash" not in serialized_response
    assert password not in response.text

    with database_engine.connect() as connection:
        user_id, user_name, password_hash = connection.execute(
            select(
                User.id,
                User.name,
                User.password_hash,
            ).where(
                User.email == email,
            )
        ).one()

        session_count = connection.scalar(
            select(func.count())
            .select_from(AuthSession)
            .where(
                AuthSession.user_id == user_id,
            )
        )

    assert user_name == "FitMap User"
    assert password_hash != password
    assert verify_password(password, password_hash) is True
    assert session_count == 1


def test_register_rejects_duplicate_email(
    client: TestClient,
    created_emails: list[str],
) -> None:
    email = f"user-{uuid4()}@example.com"
    created_emails.append(email)

    first_response = client.post(
        "/api/v1/auth/register",
        json={
            "name": "First User",
            "email": email,
            "password": "123456789012345",
        },
    )

    duplicate_response = client.post(
        "/api/v1/auth/register",
        json={
            "name": "Duplicate User",
            "email": email.upper(),
            "password": "abcdefghijklmno",
        },
    )

    assert first_response.status_code == 201
    assert duplicate_response.status_code == 409
    assert duplicate_response.json() == {
        "error": {
            "code": "account_already_exists",
            "message": "Unable to create account.",
        }
    }


def test_login_returns_new_authentication_session(
    client: TestClient,
    database_engine: Engine,
    created_emails: list[str],
) -> None:
    email = f"user-{uuid4()}@example.com"
    password = "123456789012345"
    created_emails.append(email)

    register_response = client.post(
        "/api/v1/auth/register",
        json={
            "name": "FitMap User",
            "email": email,
            "password": password,
        },
    )

    login_response = client.post(
        "/api/v1/auth/login",
        json={
            "email": email.upper(),
            "password": password,
        },
    )

    assert register_response.status_code == 201
    assert login_response.status_code == 200

    registered = register_response.json()
    logged_in = login_response.json()

    assert logged_in["user"]["id"] == registered["user"]["id"]
    assert logged_in["user"]["email"] == email

    assert logged_in["tokens"]["access_token"] != registered["tokens"]["access_token"]
    assert logged_in["tokens"]["refresh_token"] != registered["tokens"]["refresh_token"]

    with database_engine.connect() as connection:
        user_id = connection.scalar(
            select(User.id).where(
                User.email == email,
            )
        )

        assert user_id is not None

        session_count = connection.scalar(
            select(func.count())
            .select_from(AuthSession)
            .where(
                AuthSession.user_id == user_id,
            )
        )

    assert session_count == 2


def test_login_rejects_invalid_password_with_generic_error(
    client: TestClient,
    created_emails: list[str],
) -> None:
    email = f"user-{uuid4()}@example.com"
    created_emails.append(email)

    register_response = client.post(
        "/api/v1/auth/register",
        json={
            "name": "FitMap User",
            "email": email,
            "password": "123456789012345",
        },
    )

    assert register_response.status_code == 201

    response = client.post(
        "/api/v1/auth/login",
        json={
            "email": email,
            "password": "incorrect-password",
        },
    )

    assert response.status_code == 401
    assert response.json() == {
        "error": {
            "code": "invalid_credentials",
            "message": "Invalid email or password.",
        }
    }


def test_login_rejects_unknown_email_with_same_generic_error(
    client: TestClient,
) -> None:
    response = client.post(
        "/api/v1/auth/login",
        json={
            "email": f"missing-{uuid4()}@example.com",
            "password": "123456789012345",
        },
    )

    assert response.status_code == 401
    assert response.json() == {
        "error": {
            "code": "invalid_credentials",
            "message": "Invalid email or password.",
        }
    }


def test_register_rejects_invalid_payload_without_creating_account(
    client: TestClient,
    database_engine: Engine,
) -> None:
    email = f"invalid-{uuid4()}@example.com"

    response = client.post(
        "/api/v1/auth/register",
        json={
            "name": "   ",
            "email": email,
            "password": "too-short",
        },
    )

    assert response.status_code == 422
    assert response.json() == {
        "error": {
            "code": "request_validation_error",
            "message": "Request validation failed.",
        }
    }

    with database_engine.connect() as connection:
        user_id = connection.scalar(
            select(User.id).where(
                User.email == email,
            )
        )

    assert user_id is None
