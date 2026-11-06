from urllib.parse import quote

import httpx2
from pydantic import BaseModel, Field, ValidationError

from fitmap.gyms.providers import (
    Coordinates,
    GymDetails,
    GymProviderError,
    GymSearchResult,
)

_DISCOVER_URL = "https://api.tomtom.com/maps/orbis/places/discover"
_DETAILS_URL = "https://api.tomtom.com/maps/orbis/places/details/pois"

_FITNESS_TYPES = frozenset({"fitness_center", "fitness_club_and_center"})

_MAX_RESULTS = 100


class TomTomProviderError(GymProviderError):
    pass


class _TomTomPosition(BaseModel):
    coordinates: tuple[float, float]


class _TomTomPoiType(BaseModel):
    id: str


class _TomTomAddress(BaseModel):
    street: str | None = None
    house_number: str | None = Field(
        default=None,
        alias="houseNumber",
    )
    municipality: str | None = None
    subdivision: str | None = Field(
        default=None,
        alias="countrySubdivision",
    )


class _TomTomContact(BaseModel):
    phones: list[str] = Field(default_factory=list)
    websites: list[str] = Field(default_factory=list)


def _empty_poi_types() -> list[_TomTomPoiType]:
    return []


def _empty_contacts() -> list[_TomTomContact]:
    return []


class _TomTomPoi(BaseModel):
    id: str | None = None
    type: str | None = None
    title: str | None = None
    position: _TomTomPosition | None = None
    address: _TomTomAddress | None = None
    poi_types: list[_TomTomPoiType] = Field(
        default_factory=_empty_poi_types,
        alias="poiTypes",
    )
    contacts: list[_TomTomContact] = Field(default_factory=_empty_contacts)


class _TomTomDiscoverResponse(BaseModel):
    results: list[_TomTomPoi]


def _format_address(address: _TomTomAddress | None) -> str | None:
    if address is None:
        return None

    street = " ".join(part for part in (address.street, address.house_number) if part)

    parts = [
        part
        for part in (
            street,
            address.municipality,
            address.subdivision,
        )
        if part
    ]

    return ", ".join(parts) or None


def _normalize_poi(poi: _TomTomPoi) -> GymSearchResult | None:
    if poi.type != "poi":
        return None

    if poi.id is None or not poi.id.strip():
        return None

    if poi.title is None or not poi.title.strip():
        return None

    if poi.position is None:
        return None

    categories = {category.id for category in poi.poi_types}

    if not categories.intersection(_FITNESS_TYPES):
        return None

    longitude, latitude = poi.position.coordinates

    try:
        coordinates = Coordinates(
            latitude=latitude,
            longitude=longitude,
        )
    except ValidationError:
        return None

    return GymSearchResult(
        provider_name="tomtom",
        external_id=poi.id,
        name=poi.title.strip(),
        coordinates=coordinates,
        address=_format_address(poi.address),
    )


class TomTomGymProvider:
    """TomTom discovery and details adapter.

    Search by location text is intentionally outside this
    first implementation checkpoint.
    """

    def __init__(
        self,
        *,
        api_key: str,
        client: httpx2.AsyncClient,
        timeout_seconds: float = 10.0,
    ) -> None:
        if not api_key.strip():
            raise ValueError("TomTom API key must not be empty.")

        if timeout_seconds <= 0:
            raise ValueError("Timeout must be positive.")

        self._api_key = api_key
        self._client = client
        self._timeout_seconds = timeout_seconds

    def _headers(self, attributes: str) -> dict[str, str]:
        return {
            "TomTom-Api-Key": self._api_key,
            "TomTom-Api-Version": "3",
            "Attributes": attributes,
            "Accept": "application/json",
            "Accept-Language": "pt-BR",
        }

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

        if not 100 <= radius_meters <= 50_000:
            raise ValueError("Radius must be between 100 and 50000 meters.")

        request_body = {
            "maxResults": _MAX_RESULTS,
            "origin": {
                "type": "point",
                "coordinates": [
                    coordinates.longitude,
                    coordinates.latitude,
                ],
            },
            "filters": {
                "types": ["poi"],
                "countryCodesIso2": ["BR"],
                "poiTypes": sorted(_FITNESS_TYPES),
                "geometry": {
                    "type": "circle",
                    "center": [
                        coordinates.longitude,
                        coordinates.latitude,
                    ],
                    "radiusInMeters": radius_meters,
                },
            },
        }

        try:
            response = await self._client.post(
                _DISCOVER_URL,
                headers=self._headers("results(id,type,title,position,poiTypes,address)"),
                json=request_body,
                timeout=self._timeout_seconds,
            )
            response.raise_for_status()
        except httpx2.HTTPError as exc:
            raise TomTomProviderError("TomTom Discover API request failed.") from exc

        try:
            payload = _TomTomDiscoverResponse.model_validate(response.json())
        except (ValueError, TypeError) as exc:
            raise TomTomProviderError(
                "TomTom Discover API returned invalid response data."
            ) from exc

        results: list[GymSearchResult] = []
        seen_ids: set[str] = set()

        for poi in payload.results:
            gym = _normalize_poi(poi)

            if gym is None:
                continue

            if gym.external_id in seen_ids:
                continue

            seen_ids.add(gym.external_id)
            results.append(gym)

        return results

    async def get_details(
        self,
        *,
        external_id: str,
    ) -> GymDetails | None:
        if not external_id.strip():
            return None

        encoded_id = quote(external_id, safe="")

        try:
            response = await self._client.get(
                f"{_DETAILS_URL}/{encoded_id}",
                headers=self._headers("id,type,title,position,poiTypes,address,contacts"),
                timeout=self._timeout_seconds,
            )
            response.raise_for_status()
        except httpx2.HTTPStatusError as exc:
            if exc.response.status_code == 404:
                return None

            raise TomTomProviderError("TomTom Details API request failed.") from exc
        except httpx2.HTTPError as exc:
            raise TomTomProviderError("TomTom Details API request failed.") from exc

        try:
            poi = _TomTomPoi.model_validate(response.json())
        except (ValueError, TypeError) as exc:
            raise TomTomProviderError("TomTom Details API returned invalid response data.") from exc

        gym = _normalize_poi(poi)

        if gym is None:
            return None

        phone = next(
            (
                number.strip()
                for contact in poi.contacts
                for number in contact.phones
                if number.strip()
            ),
            None,
        )

        website = next(
            (url.strip() for contact in poi.contacts for url in contact.websites if url.strip()),
            None,
        )

        return GymDetails(
            provider_name=gym.provider_name,
            external_id=gym.external_id,
            name=gym.name,
            coordinates=gym.coordinates,
            address=gym.address,
            phone=phone,
            website=website,
        )
