from collections.abc import AsyncIterator
from typing import Annotated

import httpx2
from fastapi import APIRouter, Depends, Path, Query

from fitmap.api.errors import ApiError
from fitmap.gyms.config import get_gym_provider_settings
from fitmap.gyms.factory import create_geoapify_gym_provider
from fitmap.gyms.providers import (
    GymDetails,
    GymProvider,
    GymProviderError,
    GymSearchResult,
)

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
