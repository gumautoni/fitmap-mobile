import httpx2

from fitmap.gyms.cache import LocationPlaceIdCache
from fitmap.gyms.config import (
    GymProviderSettings,
    TomTomProviderSettings,
)
from fitmap.gyms.geoapify import GeoapifyGymProvider
from fitmap.gyms.tomtom import TomTomGymProvider


def create_geoapify_gym_provider(
    *,
    settings: GymProviderSettings,
    client: httpx2.AsyncClient,
    location_cache: LocationPlaceIdCache | None = None,
) -> GeoapifyGymProvider:
    return GeoapifyGymProvider(
        api_key=settings.api_key.get_secret_value(),
        client=client,
        timeout_seconds=settings.timeout_seconds,
        location_cache=location_cache,
    )


def create_tomtom_gym_provider(
    *,
    settings: TomTomProviderSettings,
    client: httpx2.AsyncClient,
) -> TomTomGymProvider | None:
    if settings.api_key is None:
        return None

    api_key = settings.api_key.get_secret_value().strip()

    if not api_key:
        return None

    return TomTomGymProvider(
        api_key=api_key,
        client=client,
        timeout_seconds=settings.timeout_seconds,
    )
