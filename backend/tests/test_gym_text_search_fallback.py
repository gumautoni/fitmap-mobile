import asyncio
import json

import httpx2
import pytest

from fitmap.gyms.geoapify import GeoapifyGymProvider
from fitmap.gyms.providers import GymProviderError
from fitmap.gyms.text_search import FallbackGymSearchProvider
from fitmap.gyms.tomtom import TomTomGymProvider


def run_search(
    *,
    geocode_results: list[dict[str, object]],
    places: list[dict[str, object]],
    tomtom_enabled: bool = True,
    tomtom_status: int = 200,
    tomtom_empty: bool = False,
    query: str = "Barra do Pira\u00ed",
) -> tuple[list[str], list[dict[str, object]]]:
    requests: list[str] = []

    def handler(request: httpx2.Request) -> httpx2.Response:
        path = request.url.path
        requests.append(path)

        if path == "/v1/geocode/search":
            assert request.url.params["text"] == query
            return httpx2.Response(
                200,
                json={"results": geocode_results},
            )

        if path == "/v2/places":
            return httpx2.Response(
                200,
                json={"features": places},
            )

        if path == "/maps/orbis/places/discover":
            body = json.loads(request.content)
            assert body["origin"]["coordinates"] == [
                geocode_results[0]["lon"],
                geocode_results[0]["lat"],
            ]
            assert body["filters"]["geometry"]["radiusInMeters"] == 10000

            if tomtom_status != 200:
                return httpx2.Response(tomtom_status)

            if tomtom_empty:
                return httpx2.Response(200, json={"results": []})

            return httpx2.Response(
                200,
                json={
                    "results": [
                        {
                            "id": "tomtom-barra-1",
                            "type": "poi",
                            "title": "Academia do Teste",
                            "position": {
                                "coordinates": [-43.825, -22.4708],
                            },
                            "poiTypes": [{"id": "fitness_center"}],
                            "address": {
                                "municipality": "Barra do Pira\u00ed",
                            },
                        }
                    ],
                },
            )

        pytest.fail("Requisicao externa inesperada.")

    async def execute() -> list[dict[str, object]]:
        transport = httpx2.MockTransport(handler)

        async with httpx2.AsyncClient(transport=transport) as client:
            geoapify = GeoapifyGymProvider(
                api_key="test-key",
                client=client,
            )

            tomtom = (
                TomTomGymProvider(api_key="test-key", client=client) if tomtom_enabled else None
            )

            provider = FallbackGymSearchProvider(
                geoapify=geoapify,
                tomtom=tomtom,
            )

            results = await provider.search_text(
                query=query,
            )

            return [item.model_dump() for item in results]

    return requests, asyncio.run(execute())


def location() -> list[dict[str, object]]:
    return [
        {
            "place_id": "barra-place-id",
            "lat": -22.4703403,
            "lon": -43.8263256,
        }
    ]


def test_empty_geoapify_uses_tomtom_fallback() -> None:
    requests, results = run_search(
        geocode_results=location(),
        places=[],
    )

    assert requests == [
        "/v1/geocode/search",
        "/v2/places",
        "/maps/orbis/places/discover",
    ]
    assert len(results) == 1
    assert results[0]["provider_name"] == "tomtom"
    assert results[0]["external_id"] == "tomtom-barra-1"


def geoapify_places() -> list[dict[str, object]]:
    return [
        {
            "properties": {
                "place_id": "geo-gym-1",
                "name": "Academia Geoapify",
                "lat": -22.4708,
                "lon": -43.825,
            }
        }
    ]


def test_tomtom_has_priority_when_geoapify_also_has_results() -> None:
    requests, results = run_search(
        geocode_results=location(),
        places=geoapify_places(),
    )

    assert requests == [
        "/v1/geocode/search",
        "/v2/places",
        "/maps/orbis/places/discover",
    ]
    assert len(results) == 1
    assert results[0]["provider_name"] == "tomtom"
    assert results[0]["external_id"] == "tomtom-barra-1"


def test_empty_tomtom_preserves_geoapify_results() -> None:
    requests, results = run_search(
        geocode_results=location(),
        places=geoapify_places(),
        tomtom_empty=True,
    )

    assert len(requests) == 3
    assert len(results) == 1
    assert results[0]["provider_name"] == "geoapify"


def test_tomtom_failure_preserves_geoapify_results() -> None:
    requests, results = run_search(
        geocode_results=location(),
        places=geoapify_places(),
        tomtom_status=503,
    )

    assert len(requests) == 3
    assert len(results) == 1
    assert results[0]["provider_name"] == "geoapify"


def test_unconfigured_tomtom_preserves_geoapify_results() -> None:
    requests, results = run_search(
        geocode_results=location(),
        places=geoapify_places(),
        tomtom_enabled=False,
    )

    assert requests == ["/v1/geocode/search", "/v2/places"]
    assert len(results) == 1
    assert results[0]["provider_name"] == "geoapify"


def test_search_uses_geocoded_center_for_another_city() -> None:
    requests, results = run_search(
        query="Volta Redonda",
        geocode_results=[
            {
                "place_id": "volta-redonda-place",
                "lat": -22.52,
                "lon": -44.10,
            }
        ],
        places=[],
    )

    assert len(requests) == 3
    assert len(results) == 1
    assert results[0]["provider_name"] == "tomtom"


def test_unknown_location_does_not_trigger_fallback() -> None:
    requests, results = run_search(
        geocode_results=[],
        places=[],
    )

    assert results == []
    assert requests == ["/v1/geocode/search"]


def test_missing_coordinates_does_not_trigger_fallback() -> None:
    requests, results = run_search(
        geocode_results=[{"place_id": "barra-place-id"}],
        places=[],
    )

    assert results == []
    assert requests == ["/v1/geocode/search", "/v2/places"]


def test_unconfigured_tomtom_preserves_empty_result() -> None:
    requests, results = run_search(
        geocode_results=location(),
        places=[],
        tomtom_enabled=False,
    )

    assert results == []
    assert requests == ["/v1/geocode/search", "/v2/places"]


def test_tomtom_error_is_not_silently_treated_as_empty() -> None:
    with pytest.raises(GymProviderError):
        run_search(
            geocode_results=location(),
            places=[],
            tomtom_status=503,
        )
