from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel

from fitmap.training.schemas import LoadUnit


class BasicProgressStatisticsResponse(BaseModel):
    completed_workouts: int
    completed_workouts_last_7_days: int
    completed_workouts_last_30_days: int
    training_days_last_30_days: int
    total_performed_sets: int


class ExerciseLoadMaximumResponse(BaseModel):
    load_unit: LoadUnit
    max_load: Decimal


class ExercisePerformancePointResponse(BaseModel):
    workout_session_id: UUID
    completed_at: datetime
    performed_sets: int
    total_repetitions: int
    max_loads: list[ExerciseLoadMaximumResponse]


class ExercisePerformanceResponse(BaseModel):
    exercise_id: UUID
    exercise_name: str
    points: list[ExercisePerformancePointResponse]
