from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from fitmap.gyms.providers import Coordinates


class FavoriteGymResponse(BaseModel):
    id: UUID
    gym_id: UUID
    provider_name: str
    external_id: str
    name: str
    coordinates: Coordinates | None = None
    address: str | None = None
    favorited_at: datetime


class GymIdentityResponse(BaseModel):
    gym_id: UUID
    provider_name: str
    external_id: str
