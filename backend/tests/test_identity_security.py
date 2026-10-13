from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from jwt import ExpiredSignatureError

from fitmap.config import Settings
from fitmap.identity.security import (
    create_access_token,
    create_refresh_token,
    decode_access_token,
    hash_password,
    hash_refresh_token,
    verify_password,
)


def test_password_hash_uses_argon2id_and_verifies_password() -> None:
    password = "FitMap-secure-password-123"

    password_hash = hash_password(password)

    assert password_hash != password
    assert password_hash.startswith("$argon2id$")
    assert verify_password(password, password_hash) is True
    assert verify_password("wrong-password", password_hash) is False


def test_access_token_round_trip(
    test_settings: Settings,
) -> None:
    user_id = uuid4()
    session_id = uuid4()
    issued_at = datetime.now(UTC).replace(microsecond=0)

    token, expires_at = create_access_token(
        user_id=user_id,
        session_id=session_id,
        settings=test_settings,
        issued_at=issued_at,
    )

    claims = decode_access_token(
        token,
        test_settings,
    )

    assert claims.user_id == user_id
    assert claims.session_id == session_id
    assert expires_at == issued_at + timedelta(minutes=15)
    assert claims.expires_at == expires_at


def test_expired_access_token_is_rejected(
    test_settings: Settings,
) -> None:
    token, _ = create_access_token(
        user_id=uuid4(),
        session_id=uuid4(),
        settings=test_settings,
        issued_at=datetime.now(UTC) - timedelta(hours=1),
    )

    with pytest.raises(ExpiredSignatureError):
        decode_access_token(
            token,
            test_settings,
        )


def test_refresh_tokens_are_random_hashed_and_expire(
    test_settings: Settings,
) -> None:
    issued_at = datetime.now(UTC).replace(microsecond=0)

    first = create_refresh_token(
        settings=test_settings,
        issued_at=issued_at,
    )
    second = create_refresh_token(
        settings=test_settings,
        issued_at=issued_at,
    )

    assert first.token != second.token
    assert first.token != first.token_hash
    assert first.token_hash == hash_refresh_token(first.token)
    assert len(first.token_hash) == 64
    assert first.expires_at == issued_at + timedelta(days=30)
