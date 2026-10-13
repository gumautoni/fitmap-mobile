from fastapi import APIRouter, Response, status
from psycopg.errors import UniqueViolation
from sqlalchemy.exc import IntegrityError

from fitmap.api.dependencies import (
    CurrentIdentityDependency,
    DatabaseSessionDependency,
    SettingsDependency,
)
from fitmap.api.errors import ApiError
from fitmap.identity.authentication import (
    AccountAlreadyExistsError,
    AuthenticationResult,
    login_user,
    register_user,
)
from fitmap.identity.schemas import (
    AuthResponse,
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
    UserResponse,
)
from fitmap.identity.sessions import (
    IssuedSessionTokens,
    RefreshRotationStatus,
    revoke_session,
    rotate_refresh_token,
)

router = APIRouter(
    prefix="/auth",
    tags=["auth"],
)


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


@router.post(
    "/refresh",
    response_model=TokenResponse,
)
def refresh(
    payload: RefreshRequest,
    db_session: DatabaseSessionDependency,
    settings: SettingsDependency,
) -> TokenResponse:
    rotation = rotate_refresh_token(
        db_session=db_session,
        refresh_token=payload.refresh_token,
        settings=settings,
    )

    if rotation.status is RefreshRotationStatus.ROTATED:
        if rotation.tokens is None:
            raise RuntimeError("Rotated refresh token result has no tokens.")

        db_session.commit()

        return _build_token_response(
            rotation.tokens,
        )

    if rotation.status is RefreshRotationStatus.SESSION_REVOKED:
        db_session.commit()
    else:
        db_session.rollback()

    raise ApiError(
        status_code=status.HTTP_401_UNAUTHORIZED,
        code="invalid_refresh_token",
        message="Invalid refresh token.",
    )


@router.get(
    "/me",
    response_model=UserResponse,
)
def get_me(
    identity: CurrentIdentityDependency,
) -> UserResponse:
    return UserResponse.model_validate(
        identity.user,
    )


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
)
def logout(
    identity: CurrentIdentityDependency,
    db_session: DatabaseSessionDependency,
) -> Response:
    revoke_session(
        db_session=db_session,
        session_id=identity.session_id,
    )
    db_session.commit()

    return Response(
        status_code=status.HTTP_204_NO_CONTENT,
    )


def _build_auth_response(
    result: AuthenticationResult,
) -> AuthResponse:
    return AuthResponse(
        user=UserResponse.model_validate(
            result.user,
        ),
        tokens=_build_token_response(
            result.tokens,
        ),
    )


def _build_token_response(
    tokens: IssuedSessionTokens,
) -> TokenResponse:
    return TokenResponse(
        access_token=tokens.access_token,
        access_token_expires_at=(tokens.access_token_expires_at),
        refresh_token=tokens.refresh_token,
        refresh_token_expires_at=(tokens.refresh_token_expires_at),
    )


def _account_creation_error() -> ApiError:
    return ApiError(
        status_code=status.HTTP_409_CONFLICT,
        code="account_already_exists",
        message="Unable to create account.",
    )
