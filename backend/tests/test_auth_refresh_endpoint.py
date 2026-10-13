from collections.abc import Iterator
from typing import TypedDict, cast
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, delete, select

from fitmap.config import Settings
from fitmap.identity.models import AuthRefreshToken, AuthSession, User
from fitmap.identity.security import (
    decode_access_token,
    hash_refresh_token,
)


class TokenPayload(TypedDict):
    access_token: str
    access_token_expires_at: str
    refresh_token: str
    refresh_token_expires_at: str
    token_type: str


class UserPayload(TypedDict):
    id: str
    name: str
    email: str
    created_at: str


class AuthPayload(TypedDict):
    user: UserPayload
    tokens: TokenPayload


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


def _register_user(
    *,
    client: TestClient,
    created_emails: list[str],
) -> AuthPayload:
    email = f"user-{uuid4()}@example.com"
    created_emails.append(email)

    response = client.post(
        "/api/v1/auth/register",
        json={
            "name": "FitMap User",
            "email": email,
            "password": "123456789012345",
        },
    )

    assert response.status_code == 201

    return cast(
        AuthPayload,
        response.json(),
    )


def test_refresh_rotates_credentials(
    client: TestClient,
    test_settings: Settings,
    created_emails: list[str],
) -> None:
    registered = _register_user(
        client=client,
        created_emails=created_emails,
    )

    original_access_token = registered["tokens"]["access_token"]
    original_refresh_token = registered["tokens"]["refresh_token"]

    response = client.post(
        "/api/v1/auth/refresh",
        json={
            "refresh_token": original_refresh_token,
        },
    )

    assert response.status_code == 200

    refreshed = cast(
        TokenPayload,
        response.json(),
    )

    assert refreshed["token_type"] == "bearer"
    assert refreshed["access_token"]
    assert refreshed["refresh_token"]

    assert refreshed["access_token"] != original_access_token
    assert refreshed["refresh_token"] != original_refresh_token

    original_claims = decode_access_token(
        original_access_token,
        test_settings,
    )
    refreshed_claims = decode_access_token(
        refreshed["access_token"],
        test_settings,
    )

    assert refreshed_claims.session_id == original_claims.session_id
    assert refreshed_claims.user_id == original_claims.user_id


def test_reusing_consumed_refresh_token_revokes_session_persistently(
    client: TestClient,
    database_engine: Engine,
    test_settings: Settings,
    created_emails: list[str],
) -> None:
    registered = _register_user(
        client=client,
        created_emails=created_emails,
    )

    original_access_token = registered["tokens"]["access_token"]
    original_refresh_token = registered["tokens"]["refresh_token"]

    first_refresh = client.post(
        "/api/v1/auth/refresh",
        json={
            "refresh_token": original_refresh_token,
        },
    )

    assert first_refresh.status_code == 200

    first_refresh_payload = cast(
        TokenPayload,
        first_refresh.json(),
    )
    replacement_refresh_token = first_refresh_payload["refresh_token"]

    reuse_response = client.post(
        "/api/v1/auth/refresh",
        json={
            "refresh_token": original_refresh_token,
        },
    )

    assert reuse_response.status_code == 401
    assert reuse_response.json() == {
        "error": {
            "code": "invalid_refresh_token",
            "message": "Invalid refresh token.",
        }
    }

    claims = decode_access_token(
        original_access_token,
        test_settings,
    )

    with database_engine.connect() as connection:
        revoked_at = connection.scalar(
            select(AuthSession.revoked_at).where(
                AuthSession.id == claims.session_id,
            )
        )

        refresh_records = connection.execute(
            select(
                AuthRefreshToken.token_hash,
                AuthRefreshToken.revoked_at,
            ).where(
                AuthRefreshToken.session_id == claims.session_id,
            )
        ).all()

    assert revoked_at is not None
    assert len(refresh_records) == 2
    assert all(refresh_record.revoked_at is not None for refresh_record in refresh_records)

    replacement_response = client.post(
        "/api/v1/auth/refresh",
        json={
            "refresh_token": replacement_refresh_token,
        },
    )

    assert replacement_response.status_code == 401


def test_unknown_refresh_token_is_rejected_without_revoking_valid_session(
    client: TestClient,
    database_engine: Engine,
    test_settings: Settings,
    created_emails: list[str],
) -> None:
    registered = _register_user(
        client=client,
        created_emails=created_emails,
    )

    access_token = registered["tokens"]["access_token"]

    response = client.post(
        "/api/v1/auth/refresh",
        json={
            "refresh_token": "unknown-refresh-token",
        },
    )

    assert response.status_code == 401
    assert response.json() == {
        "error": {
            "code": "invalid_refresh_token",
            "message": "Invalid refresh token.",
        }
    }

    claims = decode_access_token(
        access_token,
        test_settings,
    )

    with database_engine.connect() as connection:
        revoked_at = connection.scalar(
            select(AuthSession.revoked_at).where(
                AuthSession.id == claims.session_id,
            )
        )

    assert revoked_at is None


def test_refresh_rejects_empty_token(
    client: TestClient,
) -> None:
    response = client.post(
        "/api/v1/auth/refresh",
        json={
            "refresh_token": "",
        },
    )

    assert response.status_code == 422
    assert response.json() == {
        "error": {
            "code": "request_validation_error",
            "message": "Request validation failed.",
        }
    }


def test_refresh_persists_consumed_and_replacement_tokens(
    client: TestClient,
    database_engine: Engine,
    created_emails: list[str],
) -> None:
    registered = _register_user(
        client=client,
        created_emails=created_emails,
    )

    original_refresh_token = registered["tokens"]["refresh_token"]

    response = client.post(
        "/api/v1/auth/refresh",
        json={
            "refresh_token": original_refresh_token,
        },
    )

    assert response.status_code == 200

    refreshed = cast(
        TokenPayload,
        response.json(),
    )
    replacement_refresh_token = refreshed["refresh_token"]

    with database_engine.connect() as connection:
        original_record = connection.execute(
            select(
                AuthRefreshToken.consumed_at,
                AuthRefreshToken.replaced_by_token_id,
            ).where(
                AuthRefreshToken.token_hash
                == hash_refresh_token(
                    original_refresh_token,
                ),
            )
        ).one()

        replacement_id = connection.scalar(
            select(AuthRefreshToken.id).where(
                AuthRefreshToken.token_hash
                == hash_refresh_token(
                    replacement_refresh_token,
                ),
            )
        )

    assert original_record.consumed_at is not None
    assert replacement_id is not None
    assert original_record.replaced_by_token_id == replacement_id
