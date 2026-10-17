from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class WorkoutHistorySummaryResponse(BaseModel):
    id: UUID
    source_workout_id: UUID | None
    workout_name: str
    notes: str | None
    started_at: datetime
    completed_at: datetime
    created_at: datetime
    updated_at: datetime
