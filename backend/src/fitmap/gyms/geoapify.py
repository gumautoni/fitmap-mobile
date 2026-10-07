from typing import Any

import httpx2
from pydantic import BaseModel, Field

from fitmap.gyms.cache import LocationPlaceIdCache
from fitmap.gyms.providers import (
    Coordinates,
    GymDetails,
    GymProviderError,
    GymSearchResult,
)

_GEOAPIFY_PLACES_URL = "https://api.geoapify.com/v2/places"
_GEOAPIFY_PLACE_DETAILS_URL = "https://api.geoapify.com/v2/place-details"
_GEOAPIFY_GEOCODING_SEARCH_URL = "https://api.geoapify.com/v1/geocode/search"

_GYM_CATEGORIES = "sport.fitness.fitness_centre,sport.fitness.gym"

_DEFAULT_LIMIT = 20


class _GeoapifyProperties(BaseModel):
    place_id: str
    name: str | None = None
    formatted: str | None = None
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)


class _GeoapifyFeature(BaseModel):
    properties: _GeoapifyProperties


def _empty_features() -> list[_GeoapifyFeature]:
    return []


class _GeoapifyPlacesResponse(BaseModel):
    features: list[_GeoapifyFeature] = Field(default_factory=_empty_features)


class _GeoapifyGeocodingResult(BaseModel):
    place_id: str | None = None


def _empty_geocoding_results() -> list[_GeoapifyGeocodingResult]:
    return []


class _GeoapifyGeocodingResponse(BaseModel):
    results: list[_GeoapifyGeocodingResult] = Field(default_factory=_empty_geocoding_results)


class _GeoapifyContact(BaseModel):
    phone: str | None = None


class _GeoapifyWikiAndMedia(BaseModel):
    image: str | None = None


class _GeoapifyDetailsProperties(BaseModel):
    feature_type: str
    name: str | None = None
    formatted: str | None = None
    lat: float | None = Field(default=None, ge=-90, le=90)
    lon: float | None = Field(default=None, ge=-180, le=180)
    website: str | None = None
    opening_hours: str | None = None
    contact: _GeoapifyContact | None = None
    wiki_and_media: _GeoapifyWikiAndMedia | None = None


class _GeoapifyDetailsFeature(BaseModel):
    properties: _GeoapifyDetailsProperties


def _empty_detail_features() -> list[_GeoapifyDetailsFeature]:
    return []


class _GeoapifyPlaceDetailsResponse(BaseModel):
    features: list[_GeoapifyDetailsFeature] = Field(default_factory=_empty_detail_features)


class GeoapifyProviderError(GymProviderError):
    pass


def _parse_response[T: BaseModel](
    response: httpx2.Response,
    model_type: type[T],
    *,
    error_message: str,
) -> T:
    try:
        return model_type.model_validate(response.json())
    except (TypeError, ValueError) as exc:
        raise GeoapifyProviderError(error_message) from exc


class GeoapifyGymProvider:
    def __init__(
        self,
        *,
        api_key: str,
        client: httpx2.AsyncClient,
        timeout_seconds: float = 5.0,
        location_cache: LocationPlaceIdCache | None = None,
    ) -> None:
        self._api_key = api_key
        self._client = client
        self._timeout_seconds = timeout_seconds
        self._location_cache = location_cache or LocationPlaceIdCache()

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
            "categories": _GYM_CATEGORIES,
            "filter": (f"circle:{coordinates.longitude},{coordinates.latitude},{radius_meters}"),
            "bias": (f"proximity:{coordinates.longitude},{coordinates.latitude}"),
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
            raise GeoapifyProviderError("Geoapify Places API request failed.") from exc

        payload = _parse_response(
            response,
            _GeoapifyPlacesResponse,
            error_message="Geoapify Places API returned invalid response data.",
        )

        return self._normalize_search_results(payload)

    async def search_text(
        self,
        *,
        query: str,
    ) -> list[GymSearchResult]:
        normalized_query = query.strip()

        if not normalized_query:
            return []

        place_id = self._location_cache.get(normalized_query)

        if place_id is None:
            geocoding_params: dict[str, Any] = {
                "text": normalized_query,
                "type": "locality",
                "format": "json",
                "limit": 1,
                "lang": "pt",
                "apiKey": self._api_key,
            }

            try:
                response = await self._client.get(
                    _GEOAPIFY_GEOCODING_SEARCH_URL,
                    params=geocoding_params,
                    timeout=self._timeout_seconds,
                )
                response.raise_for_status()
            except httpx2.HTTPError as exc:
                raise GeoapifyProviderError("Geoapify Geocoding API request failed.") from exc

            geocoding_payload = _parse_response(
                response,
                _GeoapifyGeocodingResponse,
                error_message=("Geoapify Geocoding API returned invalid response data."),
            )

            if not geocoding_payload.results:
                return []

            location = geocoding_payload.results[0]

            if location.place_id is None:
                return []

            place_id = location.place_id

            self._location_cache.set(
                normalized_query,
                place_id,
            )

        places_params: dict[str, Any] = {
            "categories": _GYM_CATEGORIES,
            "filter": f"place:{place_id}",
            "limit": _DEFAULT_LIMIT,
            "lang": "pt",
            "apiKey": self._api_key,
        }

        try:
            response = await self._client.get(
                _GEOAPIFY_PLACES_URL,
                params=places_params,
                timeout=self._timeout_seconds,
            )
            response.raise_for_status()
        except httpx2.HTTPError as exc:
            raise GeoapifyProviderError("Geoapify Places API request failed.") from exc

        places_payload = _parse_response(
            response,
            _GeoapifyPlacesResponse,
            error_message="Geoapify Places API returned invalid response data.",
        )

        return self._normalize_search_results(places_payload)

    async def get_details(
        self,
        *,
        external_id: str,
    ) -> GymDetails | None:
        params: dict[str, Any] = {
            "id": external_id,
            "lang": "pt",
            "apiKey": self._api_key,
        }

        try:
            response = await self._client.get(
                _GEOAPIFY_PLACE_DETAILS_URL,
                params=params,
                timeout=self._timeout_seconds,
            )
            response.raise_for_status()
        except httpx2.HTTPError as exc:
            raise GeoapifyProviderError("Geoapify Place Details API request failed.") from exc

        payload = _parse_response(
            response,
            _GeoapifyPlaceDetailsResponse,
            error_message=("Geoapify Place Details API returned invalid response data."),
        )

        details_feature = next(
            (
                feature
                for feature in payload.features
                if feature.properties.feature_type == "details"
            ),
            None,
        )

        if details_feature is None:
            return None

        properties = details_feature.properties

        if properties.name is None:
            return None

        coordinates: Coordinates | None = None

        if properties.lat is not None and properties.lon is not None:
            coordinates = Coordinates(
                latitude=properties.lat,
                longitude=properties.lon,
            )

        phone = properties.contact.phone if properties.contact is not None else None

        image = properties.wiki_and_media.image if properties.wiki_and_media is not None else None

        opening_hours = [properties.opening_hours] if properties.opening_hours is not None else None

        image_urls = [image] if image is not None else []

        return GymDetails(
            provider_name="geoapify",
            external_id=external_id,
            name=properties.name,
            coordinates=coordinates,
            address=properties.formatted,
            phone=phone,
            website=properties.website,
            opening_hours=opening_hours,
            image_urls=image_urls,
        )

    @staticmethod
    def _normalize_search_results(
        payload: _GeoapifyPlacesResponse,
    ) -> list[GymSearchResult]:
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
