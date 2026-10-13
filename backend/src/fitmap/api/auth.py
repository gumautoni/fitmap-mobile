from typing import Annotated

from fastapi import APIRouter, Depends, Request, status
from psycopg.errors import UniqueViolation
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from fitmap.api.errors import ApiError
from fitmap.config import Settings
from fitmap.identity.authentication import (
    AccountAlreadyExistsError,
    AuthenticationResult,
    login_user,
    register_user,
)
from fitmap.identity.schemas import (
    AuthResponse,
    LoginRequest,
    RegisterRequest,
    TokenResponse,
    UserResponse,
)
from fitmap.persistence.database import get_db_session

router = APIRouter(
    prefix="/auth",
    tags=["auth"],
)


def get_app_settings(request: Request) -> Settings:
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


@router.post(
    "/register",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
)
def register(
    payload: RegisterRequest,
    db_session: DatabaseSessionDependency,
    settings: SettingsDependency,
) -> AuthResponse:
    try:
        result = register_user(
            db_session=db_session,
            settings=settings,
            name=payload.name,
            email=str(payload.email),
            password=payload.password,
        )
        db_session.commit()
    except AccountAlreadyExistsError as exc:
        db_session.rollback()
        raise _account_creation_error() from exc
    except IntegrityError as exc:
        db_session.rollback()

        if isinstance(exc.orig, UniqueViolation):
            raise _account_creation_error() from exc

        raise

    return _build_auth_response(result)


@router.post(
    "/login",
    response_model=AuthResponse,
)
def login(
    payload: LoginRequest,
    db_session: DatabaseSessionDependency,
    settings: SettingsDependency,
) -> AuthResponse:
    result = login_user(
        db_session=db_session,
        settings=settings,
        email=str(payload.email),
        password=payload.password,
    )

    if result is None:
        db_session.rollback()
        raise ApiError(
            status_code=status.HTTP_401_UNAUTHORIZED,
            code="invalid_credentials",
            message="Invalid email or password.",
        )

    db_session.commit()

    return _build_auth_response(result)


def _build_auth_response(
    result: AuthenticationResult,
) -> AuthResponse:
    return AuthResponse(
        user=UserResponse.model_validate(result.user),
        tokens=TokenResponse(
            access_token=result.tokens.access_token,
            access_token_expires_at=result.tokens.access_token_expires_at,
            refresh_token=result.tokens.refresh_token,
            refresh_token_expires_at=result.tokens.refresh_token_expires_at,
        ),
    )


def _account_creation_error() -> ApiError:
    return ApiError(
        status_code=status.HTTP_409_CONFLICT,
        code="account_already_exists",
        message="Unable to create account.",
    )
