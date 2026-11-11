from typing import Any

import httpx2
from pydantic import BaseModel, Field

from fitmap.gyms.providers import Coordinates, GymProviderError

_AUTOCOMPLETE_URL = "https://api.geoapify.com/v1/geocode/autocomplete"
_ALLOWED_RESULT_TYPES = frozenset({"city", "district", "suburb", "county", "state"})
_MAX_SUGGESTIONS = 5


class LocationSuggestion(BaseModel):
    label: str
    query: str
    coordinates: Coordinates


class _AutocompleteResult(BaseModel):
    formatted: str | None = None
    country_code: str | None = None
    result_type: str | None = None
    lat: float | None = Field(default=None, ge=-90, le=90)
    lon: float | None = Field(default=None, ge=-180, le=180)


def _empty_autocomplete_results() -> list[_AutocompleteResult]:
    return []


class _AutocompleteResponse(BaseModel):
    results: list[_AutocompleteResult] = Field(default_factory=_empty_autocomplete_results)


class GeoapifyLocationAutocomplete:
    def __init__(
        self,
        *,
        api_key: str,
        client: httpx2.AsyncClient,
        timeout_seconds: float = 5.0,
    ) -> None:
        if not api_key.strip():
            raise ValueError("Geoapify API key is required.")

        self._api_key = api_key
        self._client = client
        self._timeout_seconds = timeout_seconds

    async def suggest(
        self,
        *,
        query: str,
    ) -> list[LocationSuggestion]:
        normalized_query = query.strip()

        if len(normalized_query) < 2:
            return []

        params: dict[str, Any] = {
            "text": normalized_query,
            "type": "locality",
            "filter": "countrycode:br",
            "format": "json",
            "limit": _MAX_SUGGESTIONS,
            "lang": "pt",
            "apiKey": self._api_key,
        }

        try:
            response = await self._client.get(
                _AUTOCOMPLETE_URL,
                params=params,
                timeout=self._timeout_seconds,
            )
            response.raise_for_status()
        except httpx2.HTTPError as exc:
            raise GymProviderError("Geoapify autocomplete request failed.") from exc

        try:
            payload = _AutocompleteResponse.model_validate(response.json())
        except (TypeError, ValueError) as exc:
            raise GymProviderError("Geoapify autocomplete returned invalid data.") from exc

        suggestions: list[LocationSuggestion] = []
        seen: set[str] = set()

        for result in payload.results:
            if result.result_type not in _ALLOWED_RESULT_TYPES:
                continue

            if result.country_code is None or result.country_code.casefold() != "br":
                continue

            label = (result.formatted or "").strip()
            key = label.casefold()

            if not key or key in seen or result.lat is None or result.lon is None:
                continue

            seen.add(key)
            suggestions.append(
                LocationSuggestion(
                    label=label,
                    query=label,
                    coordinates=Coordinates(
                        latitude=result.lat,
                        longitude=result.lon,
                    ),
                )
            )

            if len(suggestions) == _MAX_SUGGESTIONS:
                break

        return suggestions
