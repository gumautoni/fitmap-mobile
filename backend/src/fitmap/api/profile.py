from fastapi import APIRouter

from fitmap.api.dependencies import (
    CurrentIdentityDependency,
    DatabaseSessionDependency,
)
from fitmap.identity.profiles import update_user_profile
from fitmap.identity.schemas import (
    ProfileResponse,
    ProfileUpdateRequest,
)

router = APIRouter(
    prefix="/profile",
    tags=["profile"],
)


@router.get(
    "",
    response_model=ProfileResponse,
)
def get_profile(
    identity: CurrentIdentityDependency,
) -> ProfileResponse:
    return ProfileResponse.model_validate(
        identity.user,
    )


@router.patch(
    "",
    response_model=ProfileResponse,
)
def update_profile(
    payload: ProfileUpdateRequest,
    identity: CurrentIdentityDependency,
    db_session: DatabaseSessionDependency,
) -> ProfileResponse:
    user = update_user_profile(
        db_session=db_session,
        user=identity.user,
        name=payload.name,
    )

    db_session.commit()

    return ProfileResponse.model_validate(
        user,
    )
