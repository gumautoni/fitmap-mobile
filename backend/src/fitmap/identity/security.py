import secrets
from collections.abc import Mapping
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from hashlib import sha256
from uuid import UUID, uuid4

import jwt
from jwt import InvalidTokenError
from pwdlib import PasswordHash

from fitmap.config import Settings

_PASSWORD_HASH = PasswordHash.recommended()
_REFRESH_TOKEN_BYTES = 48


@dataclass(frozen=True, slots=True)
class AccessTokenClaims:
    user_id: UUID
    session_id: UUID
    token_id: UUID
    expires_at: datetime


@dataclass(frozen=True, slots=True, repr=False)
class RefreshTokenMaterial:
    token: str
    token_hash: str
    expires_at: datetime


def hash_password(password: str) -> str:
    return _PASSWORD_HASH.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return _PASSWORD_HASH.verify(password, password_hash)


def create_access_token(
    *,
    user_id: UUID,
    session_id: UUID,
    settings: Settings,
    issued_at: datetime | None = None,
) -> tuple[str, datetime]:
    now = issued_at or datetime.now(UTC)
    expires_at = now + timedelta(
        minutes=settings.auth_access_token_minutes,
    )
    token_id = uuid4()

    payload = {
        "sub": str(user_id),
        "sid": str(session_id),
        "jti": str(token_id),
        "token_type": "access",
        "iss": settings.auth_jwt_issuer,
        "aud": settings.auth_jwt_audience,
        "iat": now,
        "nbf": now,
        "exp": expires_at,
    }

    token = jwt.encode(  # pyright: ignore[reportUnknownMemberType]
        payload,
        settings.auth_jwt_secret.get_secret_value(),
        algorithm=settings.auth_jwt_algorithm,
    )

    return token, expires_at


def decode_access_token(
    token: str,
    settings: Settings,
) -> AccessTokenClaims:
    payload = jwt.decode(  # pyright: ignore[reportUnknownMemberType]
        token,
        settings.auth_jwt_secret.get_secret_value(),
        algorithms=[settings.auth_jwt_algorithm],
        audience=settings.auth_jwt_audience,
        issuer=settings.auth_jwt_issuer,
        options={
            "require": [
                "aud",
                "exp",
                "iat",
                "iss",
                "jti",
                "nbf",
                "sid",
                "sub",
                "token_type",
            ]
        },
    )

    if payload.get("token_type") != "access":
        raise InvalidTokenError("Invalid token type.")

    user_id = _parse_uuid_claim(payload, "sub")
    session_id = _parse_uuid_claim(payload, "sid")
    token_id = _parse_uuid_claim(payload, "jti")
    expires_at = _parse_numeric_date_claim(payload, "exp")

    return AccessTokenClaims(
        user_id=user_id,
        session_id=session_id,
        token_id=token_id,
        expires_at=expires_at,
    )


def create_refresh_token(
    *,
    settings: Settings,
    issued_at: datetime | None = None,
) -> RefreshTokenMaterial:
    now = issued_at or datetime.now(UTC)
    token = secrets.token_urlsafe(_REFRESH_TOKEN_BYTES)

    return RefreshTokenMaterial(
        token=token,
        token_hash=hash_refresh_token(token),
        expires_at=now
        + timedelta(
            days=settings.auth_refresh_token_days,
        ),
    )


def hash_refresh_token(token: str) -> str:
    return sha256(token.encode("utf-8")).hexdigest()


def _parse_uuid_claim(
    payload: Mapping[str, object],
    claim_name: str,
) -> UUID:
    value = payload.get(claim_name)

    if not isinstance(value, str):
        raise InvalidTokenError(f"Invalid {claim_name} claim.")

    try:
        return UUID(value)
    except ValueError as exc:
        raise InvalidTokenError(
            f"Invalid {claim_name} claim.",
        ) from exc


def _parse_numeric_date_claim(
    payload: Mapping[str, object],
    claim_name: str,
) -> datetime:
    value = payload.get(claim_name)

    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise InvalidTokenError(f"Invalid {claim_name} claim.")

    return datetime.fromtimestamp(value, tz=UTC)
