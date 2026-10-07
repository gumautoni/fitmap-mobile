from typing import Protocol

from pydantic import BaseModel, Field


class Coordinates(BaseModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)


class GymSearchResult(BaseModel):
    provider_name: str
    external_id: str
    name: str
    coordinates: Coordinates | None = None
    address: str | None = None


class GymDetails(GymSearchResult):
    phone: str | None = None
    website: str | None = None
    opening_hours: list[str] | None = None
    image_urls: list[str] = Field(default_factory=list)
    amenities: list[str] = Field(default_factory=list)


class GymProviderError(Exception):
    pass


class GymProvider(Protocol):
    async def search_nearby(
        self,
        *,
        latitude: float,
        longitude: float,
        radius_meters: int,
    ) -> list[GymSearchResult]: ...

    async def search_text(
        self,
        *,
        query: str,
    ) -> list[GymSearchResult]: ...

    async def get_details(
        self,
        *,
        external_id: str,
    ) -> GymDetails | None: ...
