from collections.abc import AsyncIterator
from typing import Annotated
from uuid import UUID

import httpx2
from fastapi import APIRouter, Depends, Path, Query, Response, status

from fitmap.api.dependencies import (
    CurrentIdentityDependency,
    DatabaseSessionDependency,
)
from fitmap.api.errors import ApiError
from fitmap.gyms.config import get_gym_provider_settings
from fitmap.gyms.factory import create_geoapify_gym_provider
from fitmap.gyms.favorites import (
    FavoriteGymAlreadyExistsError,
    FavoriteGymNotFoundError,
    FavoriteGymView,
    add_favorite_gym,
    get_favorite_gym_view,
    list_favorite_gyms,
    remove_favorite_gym,
)
from fitmap.gyms.providers import (
    Coordinates,
    GymDetails,
    GymProvider,
    GymProviderError,
    GymSearchResult,
)
from fitmap.gyms.schemas import FavoriteGymResponse

router = APIRouter(
    prefix="/gyms",
    tags=["gyms"],
)


async def get_gym_provider() -> AsyncIterator[GymProvider]:
    settings = get_gym_provider_settings()

    async with httpx2.AsyncClient() as client:
        yield create_geoapify_gym_provider(
            settings=settings,
            client=client,
        )


GymProviderDependency = Annotated[
    GymProvider,
    Depends(get_gym_provider),
]

LocationQuery = Annotated[
    str,
    Query(
        min_length=1,
        max_length=200,
    ),
]

LatitudeQuery = Annotated[
    float,
    Query(
        ge=-90,
        le=90,
    ),
]

LongitudeQuery = Annotated[
    float,
    Query(
        ge=-180,
        le=180,
    ),
]

RadiusMetersQuery = Annotated[
    int,
    Query(
        ge=100,
        le=50_000,
    ),
]

GymExternalIdPath = Annotated[
    str,
    Path(
        min_length=1,
        max_length=500,
    ),
]


def _favorite_response(
    favorite: FavoriteGymView,
) -> FavoriteGymResponse:
    coordinates: Coordinates | None = None

    if favorite.latitude is not None and favorite.longitude is not None:
        coordinates = Coordinates(
            latitude=favorite.latitude,
            longitude=favorite.longitude,
        )

    return FavoriteGymResponse(
        id=favorite.favorite_id,
        gym_id=favorite.gym_id,
        provider_name=favorite.provider_name,
        external_id=favorite.external_id,
        name=favorite.name,
        coordinates=coordinates,
        address=favorite.address,
        favorited_at=favorite.favorited_at,
    )


@router.get(
    "/search",
    response_model=list[GymSearchResult],
)
async def search_gyms(
    query: LocationQuery,
    provider: GymProviderDependency,
) -> list[GymSearchResult]:
    normalized_query = query.strip()

    if not normalized_query:
        raise ApiError(
            status_code=422,
            code="request_validation_error",
            message="Request validation failed.",
        )

    try:
        return await provider.search_text(
            query=normalized_query,
        )
    except GymProviderError as exc:
        raise ApiError(
            status_code=502,
            code="gym_provider_unavailable",
            message="Gym provider is unavailable.",
        ) from exc


@router.get(
    "/nearby",
    response_model=list[GymSearchResult],
)
async def search_nearby_gyms(
    latitude: LatitudeQuery,
    longitude: LongitudeQuery,
    provider: GymProviderDependency,
    radius_meters: RadiusMetersQuery = 5_000,
) -> list[GymSearchResult]:
    try:
        return await provider.search_nearby(
            latitude=latitude,
            longitude=longitude,
            radius_meters=radius_meters,
        )
    except GymProviderError as exc:
        raise ApiError(
            status_code=502,
            code="gym_provider_unavailable",
            message="Gym provider is unavailable.",
        ) from exc


@router.get(
    "/favorites",
    response_model=list[FavoriteGymResponse],
)
def get_favorite_gyms(
    identity: CurrentIdentityDependency,
    db_session: DatabaseSessionDependency,
) -> list[FavoriteGymResponse]:
    favorites = list_favorite_gyms(
        db_session=db_session,
        user_id=identity.user.id,
    )

    return [_favorite_response(favorite) for favorite in favorites]


@router.delete(
    "/favorites/{gym_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_favorite_gym(
    gym_id: UUID,
    identity: CurrentIdentityDependency,
    db_session: DatabaseSessionDependency,
) -> Response:
    try:
        remove_favorite_gym(
            db_session=db_session,
            user_id=identity.user.id,
            gym_id=gym_id,
        )
    except FavoriteGymNotFoundError as exc:
        raise ApiError(
            status_code=404,
            code="favorite_gym_not_found",
            message="Favorite gym was not found.",
        ) from exc

    db_session.commit()

    return Response(
        status_code=status.HTTP_204_NO_CONTENT,
    )


@router.get(
    "/{external_id}",
    response_model=GymDetails,
)
async def get_gym_details(
    external_id: GymExternalIdPath,
    provider: GymProviderDependency,
) -> GymDetails:
    try:
        details = await provider.get_details(
            external_id=external_id,
        )
    except GymProviderError as exc:
        raise ApiError(
            status_code=502,
            code="gym_provider_unavailable",
            message="Gym provider is unavailable.",
        ) from exc

    if details is None:
        raise ApiError(
            status_code=404,
            code="gym_not_found",
            message="Gym details were not found.",
        )

    return details


@router.post(
    "/{external_id}/favorite",
    response_model=FavoriteGymResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_favorite_gym(
    external_id: GymExternalIdPath,
    identity: CurrentIdentityDependency,
    db_session: DatabaseSessionDependency,
    provider: GymProviderDependency,
) -> FavoriteGymResponse:
    try:
        details = await provider.get_details(
            external_id=external_id,
        )
    except GymProviderError as exc:
        raise ApiError(
            status_code=502,
            code="gym_provider_unavailable",
            message="Gym provider is unavailable.",
        ) from exc

    if details is None:
        raise ApiError(
            status_code=404,
            code="gym_not_found",
            message="Gym details were not found.",
        )

    try:
        favorite = add_favorite_gym(
            db_session=db_session,
            user_id=identity.user.id,
            provider_gym=details,
        )
    except FavoriteGymAlreadyExistsError as exc:
        raise ApiError(
            status_code=409,
            code="favorite_gym_already_exists",
            message="Gym is already in favorites.",
        ) from exc

    favorite_view = get_favorite_gym_view(
        db_session=db_session,
        user_id=identity.user.id,
        gym_id=favorite.gym_id,
    )

    db_session.commit()

    return _favorite_response(favorite_view)
