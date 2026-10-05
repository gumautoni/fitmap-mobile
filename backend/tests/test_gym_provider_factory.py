import asyncio

import httpx2
from pydantic import SecretStr

from fitmap.gyms.config import GymProviderSettings
from fitmap.gyms.factory import create_geoapify_gym_provider


def test_create_geoapify_gym_provider_uses_configured_api_key() -> None:
    def handler(request: httpx2.Request) -> httpx2.Response:
        assert request.url.params["apiKey"] == "test-api-key"

        return httpx2.Response(
            200,
            request=request,
            json={"features": []},
        )

    async def run_test() -> None:
        settings = GymProviderSettings(
            api_key=SecretStr("test-api-key"),
            timeout_seconds=7.5,
        )

        transport = httpx2.MockTransport(handler)

        async with httpx2.AsyncClient(transport=transport) as client:
            provider = create_geoapify_gym_provider(
                settings=settings,
                client=client,
            )

            results = await provider.search_nearby(
                latitude=-22.4708,
                longitude=-43.8258,
                radius_meters=5000,
            )

        assert results == []

    asyncio.run(run_test())
