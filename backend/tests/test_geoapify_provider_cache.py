import asyncio

import httpx2

from fitmap.gyms.cache import LocationPlaceIdCache
from fitmap.gyms.geoapify import GeoapifyGymProvider


def test_search_text_reuses_cached_location_place_id() -> None:
    geocoding_requests = 0
    places_requests = 0

    def handler(request: httpx2.Request) -> httpx2.Response:
        nonlocal geocoding_requests
        nonlocal places_requests

        if request.url.path == "/v1/geocode/search":
            geocoding_requests += 1

            assert request.url.params["text"] == "Barra do Piraí, RJ"

            return httpx2.Response(
                200,
                request=request,
                json={
                    "results": [
                        {
                            "place_id": "location-place-123",
                        }
                    ]
                },
            )

        assert request.url.path == "/v2/places"

        places_requests += 1

        assert request.url.params["filter"] == "place:location-place-123"

        return httpx2.Response(
            200,
            request=request,
            json={
                "features": [
                    {
                        "properties": {
                            "place_id": "gym-place-123",
                            "name": "Academia Barra Fitness",
                            "formatted": "Barra do Piraí, RJ",
                            "lat": -22.4708,
                            "lon": -43.8258,
                        }
                    }
                ]
            },
        )

    async def run_searches() -> None:
        transport = httpx2.MockTransport(handler)
        location_cache = LocationPlaceIdCache(
            ttl_seconds=300.0,
        )

        async with httpx2.AsyncClient(transport=transport) as client:
            provider = GeoapifyGymProvider(
                api_key="test-api-key",
                client=client,
                location_cache=location_cache,
            )

            first_results = await provider.search_text(
                query="Barra do Piraí, RJ",
            )

            second_results = await provider.search_text(
                query="  barra DO piraí, rj  ",
            )

        assert len(first_results) == 1
        assert len(second_results) == 1

        assert first_results[0].external_id == "gym-place-123"
        assert second_results[0].external_id == "gym-place-123"

    asyncio.run(run_searches())

    assert geocoding_requests == 1
    assert places_requests == 2
