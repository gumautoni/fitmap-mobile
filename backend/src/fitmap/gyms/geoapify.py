from typing import Any

import httpx2
from pydantic import BaseModel, Field

from fitmap.gyms.providers import Coordinates, GymSearchResult

_GEOAPIFY_PLACES_URL = "https://api.geoapify.com/v2/places"
_GYM_CATEGORY = "sport.fitness.gym"
_DEFAULT_LIMIT = 20


class _GeoapifyProperties(BaseModel):
    place_id: str
    name: str | None = None
    formatted: str | None = None
    lat: float
    lon: float


class _GeoapifyFeature(BaseModel):
    properties: _GeoapifyProperties


def _empty_features() -> list[_GeoapifyFeature]:
    return []


class _GeoapifyPlacesResponse(BaseModel):
    features: list[_GeoapifyFeature] = Field(default_factory=_empty_features)


class GeoapifyProviderError(Exception):
    pass


class GeoapifyGymProvider:
    def __init__(
        self,
        *,
        api_key: str,
        client: httpx2.AsyncClient,
        timeout_seconds: float = 5.0,
    ) -> None:
        self._api_key = api_key
        self._client = client
        self._timeout_seconds = timeout_seconds

    async def search_nearby(
        self,
        *,
        latitude: float,
        longitude: float,
        radius_meters: int,
    ) -> list[GymSearchResult]:
        coordinates = Coordinates(
            latitude=latitude,
            longitude=longitude,
        )

        params: dict[str, Any] = {
            "categories": _GYM_CATEGORY,
            "filter": (
                f"circle:{coordinates.longitude},"
                f"{coordinates.latitude},"
                f"{radius_meters}"
            ),
            "bias": (
                f"proximity:{coordinates.longitude},"
                f"{coordinates.latitude}"
            ),
            "limit": _DEFAULT_LIMIT,
            "lang": "pt",
            "apiKey": self._api_key,
        }

        try:
            response = await self._client.get(
                _GEOAPIFY_PLACES_URL,
                params=params,
                timeout=self._timeout_seconds,
            )
            response.raise_for_status()
        except httpx2.HTTPError as exc:
            raise GeoapifyProviderError(
                "Geoapify Places API request failed."
            ) from exc

        payload = _GeoapifyPlacesResponse.model_validate(response.json())

        results: list[GymSearchResult] = []

        for feature in payload.features:
            properties = feature.properties

            if properties.name is None:
                continue

            results.append(
                GymSearchResult(
                    provider_name="geoapify",
                    external_id=properties.place_id,
                    name=properties.name,
                    coordinates=Coordinates(
                        latitude=properties.lat,
                        longitude=properties.lon,
                    ),
                    address=properties.formatted,
                )
            )

        return results
