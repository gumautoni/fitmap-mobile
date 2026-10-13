from dataclasses import dataclass
from typing import Annotated
from uuid import UUID

from fastapi import Depends, Request, status
from fastapi.security import (
    HTTPAuthorizationCredentials,
    HTTPBearer,
)
from jwt import InvalidTokenError
from sqlalchemy.orm import Session

from fitmap.api.errors import ApiError
from fitmap.config import Settings
from fitmap.identity.models import User
from fitmap.identity.security import decode_access_token
from fitmap.identity.sessions import is_session_active
from fitmap.persistence.database import get_db_session

_bearer_scheme = HTTPBearer(
    auto_error=False,
)


@dataclass(frozen=True, slots=True)
class AuthenticatedIdentity:
    user: User
    session_id: UUID


def get_app_settings(
    request: Request,
) -> Settings:
    settings = getattr(
        request.app.state,
        "settings",
        None,
    )

    if not isinstance(settings, Settings):
        raise RuntimeError("Application settings are not configured.")

    return settings


DatabaseSessionDependency = Annotated[
    Session,
    Depends(get_db_session),
]

SettingsDependency = Annotated[
    Settings,
    Depends(get_app_settings),
]

BearerCredentialsDependency = Annotated[
    HTTPAuthorizationCredentials | None,
    Depends(_bearer_scheme),
]


def get_current_identity(
    credentials: BearerCredentialsDependency,
    db_session: DatabaseSessionDependency,
    settings: SettingsDependency,
) -> AuthenticatedIdentity:
    if credentials is None or credentials.scheme.casefold() != "bearer":
        raise invalid_access_token_error()

    try:
        claims = decode_access_token(
            credentials.credentials,
            settings,
        )
    except InvalidTokenError as exc:
        raise invalid_access_token_error() from exc

    if not is_session_active(
        db_session=db_session,
        session_id=claims.session_id,
        user_id=claims.user_id,
    ):
        raise invalid_access_token_error()

    user = db_session.get(
        User,
        claims.user_id,
    )

    if user is None or not user.is_active:
        raise invalid_access_token_error()

    return AuthenticatedIdentity(
        user=user,
        session_id=claims.session_id,
    )


CurrentIdentityDependency = Annotated[
    AuthenticatedIdentity,
    Depends(get_current_identity),
]


def invalid_access_token_error() -> ApiError:
    return ApiError(
        status_code=status.HTTP_401_UNAUTHORIZED,
        code="invalid_access_token",
        message="Invalid or expired access token.",
    )
