from datetime import datetime
from decimal import Decimal
from typing import Self
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from fitmap.progress.goal_progress import GoalProgressStatus
from fitmap.progress.schemas import (
    BODY_MEASUREMENT_UNITS,
    WEIGHT_METRIC_UNITS,
    BodyMetricType,
    BodyMetricUnit,
)


class FitnessGoalCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    metric_type: BodyMetricType

    target_value: Decimal = Field(
        gt=0,
        max_digits=10,
        decimal_places=2,
    )

    unit: BodyMetricUnit

    @model_validator(mode="after")
    def validate_target_unit(self) -> Self:
        allowed_units = (
            WEIGHT_METRIC_UNITS
            if self.metric_type == BodyMetricType.WEIGHT
            else BODY_MEASUREMENT_UNITS
        )

        if self.unit not in allowed_units:
            raise ValueError("Goal unit is incompatible with metric type.")

        return self


class FitnessGoalResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    metric_type: BodyMetricType
    target_value: Decimal
    unit: BodyMetricUnit
    created_at: datetime
    updated_at: datetime


class FitnessGoalProgressResponse(BaseModel):
    goal: FitnessGoalResponse
    status: GoalProgressStatus
    baseline_value: Decimal | None
    current_value: Decimal | None
    progress_percent: Decimal | None
