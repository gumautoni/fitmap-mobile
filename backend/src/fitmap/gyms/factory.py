import httpx2

from fitmap.gyms.config import GymProviderSettings
from fitmap.gyms.geoapify import GeoapifyGymProvider
from fitmap.gyms.providers import GymProvider


def create_geoapify_gym_provider(
    *,
    settings: GymProviderSettings,
    client: httpx2.AsyncClient,
) -> GymProvider:
    return GeoapifyGymProvider(
        api_key=settings.api_key.get_secret_value(),
        client=client,
        timeout_seconds=settings.timeout_seconds,
    )
