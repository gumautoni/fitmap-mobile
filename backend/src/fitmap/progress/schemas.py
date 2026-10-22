from datetime import datetime
from decimal import Decimal
from enum import StrEnum
from typing import Self
from uuid import UUID

from pydantic import (
    AwareDatetime,
    BaseModel,
    ConfigDict,
    Field,
    model_validator,
)

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


class ProgressPhotoResponse(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
    )

    id: UUID
    workout_session_id: UUID | None
    media_type: str
    recorded_at: datetime
    created_at: datetime


class BodyMetricType(StrEnum):
    WEIGHT = "weight"
    WAIST = "waist"
    CHEST = "chest"
    ARM = "arm"
    THIGH = "thigh"
    HIP = "hip"


class BodyMetricUnit(StrEnum):
    KG = "kg"
    LB = "lb"
    CM = "cm"
    IN = "in"


WEIGHT_METRIC_UNITS = frozenset(
    {
        BodyMetricUnit.KG,
        BodyMetricUnit.LB,
    }
)

BODY_MEASUREMENT_UNITS = frozenset(
    {
        BodyMetricUnit.CM,
        BodyMetricUnit.IN,
    }
)


class BodyMetricCreateRequest(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
    )

    metric_type: BodyMetricType

    value: Decimal = Field(
        gt=0,
        max_digits=10,
        decimal_places=2,
    )

    unit: BodyMetricUnit

    recorded_at: AwareDatetime

    @model_validator(mode="after")
    def validate_metric_unit(self) -> Self:
        if self.metric_type == BodyMetricType.WEIGHT:
            allowed_units = WEIGHT_METRIC_UNITS
        else:
            allowed_units = BODY_MEASUREMENT_UNITS

        if self.unit not in allowed_units:
            raise ValueError("Measurement unit is incompatible with metric type.")

        return self


class BodyMetricResponse(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
    )

    id: UUID
    metric_type: BodyMetricType
    value: Decimal
    unit: BodyMetricUnit
    recorded_at: datetime
    created_at: datetime
    updated_at: datetime
