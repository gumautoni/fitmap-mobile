import asyncio
import json

import httpx2
import pytest

from fitmap.gyms.tomtom import TomTomGymProvider, TomTomProviderError


def make_poi(
    *,
    gym_id: str = "tomtom-123",
    name: str = "Academia Evolution",
) -> dict[str, object]:
    return {
        "id": gym_id,
        "type": "poi",
        "title": name,
        "position": {
            "type": "Point",
            "coordinates": [-43.66093, -22.40939],
        },
        "poiTypes": [{"id": "fitness_center"}],
        "address": {
            "street": "Rua Central",
            "houseNumber": "123",
            "municipality": "Vassouras",
            "countrySubdivision": "RJ",
        },
    }


def test_search_nearby_builds_category_request() -> None:
    def handler(request: httpx2.Request) -> httpx2.Response:
        assert request.method == "POST"
        assert request.url.path == "/maps/orbis/places/discover"
        assert "test-api-key" not in str(request.url)
        assert request.headers["TomTom-Api-Key"] == "test-api-key"
        assert request.headers["TomTom-Api-Version"] == "3"

        body = json.loads(request.content)

        assert "query" not in body
        assert body["maxResults"] == 100
        assert body["origin"]["coordinates"] == [
            -43.66093,
            -22.40939,
        ]

        filters = body["filters"]

        assert filters["types"] == ["poi"]
        assert filters["countryCodesIso2"] == ["BR"]
        assert set(filters["poiTypes"]) == {
            "fitness_center",
            "fitness_club_and_center",
        }

        assert filters["geometry"] == {
            "type": "circle",
            "center": [-43.66093, -22.40939],
            "radiusInMeters": 10000,
        }

        return httpx2.Response(
            200,
            json={"results": [make_poi()]},
        )

    async def run_test() -> None:
        async with httpx2.AsyncClient(transport=httpx2.MockTransport(handler)) as client:
            provider = TomTomGymProvider(
                api_key="test-api-key",
                client=client,
            )

            results = await provider.search_nearby(
                latitude=-22.40939,
                longitude=-43.66093,
                radius_meters=10000,
            )

        assert len(results) == 1

        gym = results[0]

        assert gym.provider_name == "tomtom"
        assert gym.external_id == "tomtom-123"
        assert gym.name == "Academia Evolution"
        assert gym.address == "Rua Central 123, Vassouras, RJ"
        assert gym.coordinates is not None
        assert gym.coordinates.latitude == -22.40939
        assert gym.coordinates.longitude == -43.66093

    asyncio.run(run_test())


def test_search_nearby_skips_invalid_and_duplicate_pois() -> None:
    invalid_category = make_poi(gym_id="unrelated")
    invalid_category["poiTypes"] = [{"id": "restaurant"}]

    invalid_coordinates = make_poi(gym_id="invalid-position")
    invalid_coordinates["position"] = {
        "coordinates": [-43.66093, 999.0],
    }

    blank_name = make_poi(gym_id="blank")
    blank_name["title"] = " "

    not_poi = make_poi(gym_id="address")
    not_poi["type"] = "address"

    def handler(request: httpx2.Request) -> httpx2.Response:
        return httpx2.Response(
            200,
            json={
                "results": [
                    make_poi(),
                    make_poi(),
                    invalid_category,
                    invalid_coordinates,
                    blank_name,
                    not_poi,
                ]
            },
        )

    async def run_test() -> None:
        async with httpx2.AsyncClient(transport=httpx2.MockTransport(handler)) as client:
            provider = TomTomGymProvider(
                api_key="test-api-key",
                client=client,
            )

            results = await provider.search_nearby(
                latitude=-22.40939,
                longitude=-43.66093,
                radius_meters=5000,
            )

        assert len(results) == 1
        assert results[0].external_id == "tomtom-123"

    asyncio.run(run_test())


def test_search_nearby_returns_empty_list() -> None:
    def handler(request: httpx2.Request) -> httpx2.Response:
        return httpx2.Response(200, json={"results": []})

    async def run_test() -> None:
        async with httpx2.AsyncClient(transport=httpx2.MockTransport(handler)) as client:
            provider = TomTomGymProvider(
                api_key="test-api-key",
                client=client,
            )

            results = await provider.search_nearby(
                latitude=-22.40939,
                longitude=-43.66093,
                radius_meters=5000,
            )

        assert results == []

    asyncio.run(run_test())


def test_search_nearby_converts_http_error() -> None:
    def handler(request: httpx2.Request) -> httpx2.Response:
        return httpx2.Response(503)

    async def run_test() -> None:
        async with httpx2.AsyncClient(transport=httpx2.MockTransport(handler)) as client:
            provider = TomTomGymProvider(
                api_key="test-api-key",
                client=client,
            )

            with pytest.raises(
                TomTomProviderError,
                match="TomTom Discover API request failed",
            ):
                await provider.search_nearby(
                    latitude=-22.40939,
                    longitude=-43.66093,
                    radius_meters=5000,
                )

    asyncio.run(run_test())


def test_search_nearby_converts_timeout() -> None:
    def handler(request: httpx2.Request) -> httpx2.Response:
        raise httpx2.ConnectTimeout(
            "Simulated timeout",
            request=request,
        )

    async def run_test() -> None:
        async with httpx2.AsyncClient(transport=httpx2.MockTransport(handler)) as client:
            provider = TomTomGymProvider(
                api_key="test-api-key",
                client=client,
            )

            with pytest.raises(TomTomProviderError):
                await provider.search_nearby(
                    latitude=-22.40939,
                    longitude=-43.66093,
                    radius_meters=5000,
                )

    asyncio.run(run_test())


def test_search_nearby_rejects_invalid_payload() -> None:
    def handler(request: httpx2.Request) -> httpx2.Response:
        return httpx2.Response(
            200,
            json={"results": "invalid"},
        )

    async def run_test() -> None:
        async with httpx2.AsyncClient(transport=httpx2.MockTransport(handler)) as client:
            provider = TomTomGymProvider(
                api_key="test-api-key",
                client=client,
            )

            with pytest.raises(
                TomTomProviderError,
                match="invalid response data",
            ):
                await provider.search_nearby(
                    latitude=-22.40939,
                    longitude=-43.66093,
                    radius_meters=5000,
                )

    asyncio.run(run_test())


def test_search_nearby_rejects_invalid_radius_without_request() -> None:
    def handler(request: httpx2.Request) -> httpx2.Response:
        pytest.fail("Unexpected external request")

    async def run_test() -> None:
        async with httpx2.AsyncClient(transport=httpx2.MockTransport(handler)) as client:
            provider = TomTomGymProvider(
                api_key="test-api-key",
                client=client,
            )

            with pytest.raises(ValueError, match="Radius"):
                await provider.search_nearby(
                    latitude=-22.40939,
                    longitude=-43.66093,
                    radius_meters=10,
                )

    asyncio.run(run_test())


def test_get_details_normalizes_contact_information() -> None:
    def handler(request: httpx2.Request) -> httpx2.Response:
        assert request.method == "GET"
        assert request.url.path == ("/maps/orbis/places/details/pois/tomtom-123")
        assert "test-api-key" not in str(request.url)
        assert request.headers["TomTom-Api-Key"] == "test-api-key"

        poi = make_poi()
        poi["contacts"] = [
            {
                "phones": ["+55 24 99999-9999"],
                "websites": ["https://academia.example"],
            }
        ]

        return httpx2.Response(200, json=poi)

    async def run_test() -> None:
        async with httpx2.AsyncClient(transport=httpx2.MockTransport(handler)) as client:
            provider = TomTomGymProvider(
                api_key="test-api-key",
                client=client,
            )

            gym = await provider.get_details(
                external_id="tomtom-123",
            )

        assert gym is not None
        assert gym.provider_name == "tomtom"
        assert gym.external_id == "tomtom-123"
        assert gym.name == "Academia Evolution"
        assert gym.address == "Rua Central 123, Vassouras, RJ"
        assert gym.phone == "+55 24 99999-9999"
        assert gym.website == "https://academia.example"
        assert gym.opening_hours is None
        assert gym.image_urls == []
        assert gym.amenities == []

    asyncio.run(run_test())


def test_get_details_returns_none_on_404() -> None:
    def handler(request: httpx2.Request) -> httpx2.Response:
        return httpx2.Response(404)

    async def run_test() -> None:
        async with httpx2.AsyncClient(transport=httpx2.MockTransport(handler)) as client:
            provider = TomTomGymProvider(
                api_key="test-api-key",
                client=client,
            )

            gym = await provider.get_details(
                external_id="not-found",
            )

        assert gym is None

    asyncio.run(run_test())


def test_get_details_converts_provider_failure() -> None:
    def handler(request: httpx2.Request) -> httpx2.Response:
        return httpx2.Response(503)

    async def run_test() -> None:
        async with httpx2.AsyncClient(transport=httpx2.MockTransport(handler)) as client:
            provider = TomTomGymProvider(
                api_key="test-api-key",
                client=client,
            )

            with pytest.raises(
                TomTomProviderError,
                match="TomTom Details API request failed",
            ):
                await provider.get_details(
                    external_id="tomtom-123",
                )

    asyncio.run(run_test())
