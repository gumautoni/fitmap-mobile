from datetime import datetime
from decimal import Decimal
from enum import StrEnum
from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_validator,
)

from fitmap.training.schemas import (
    LoadUnit,
    normalize_optional_notes,
)


class WorkoutSessionStatus(StrEnum):
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class WorkoutSessionNotesUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    notes: str | None = None

    @field_validator("notes")
    @classmethod
    def normalize_notes_field(
        cls,
        value: str | None,
    ) -> str | None:
        return normalize_optional_notes(value)


class ExerciseExecutionUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    notes: str | None = None
    completed: bool | None = None

    @field_validator("notes")
    @classmethod
    def normalize_notes_field(
        cls,
        value: str | None,
    ) -> str | None:
        return normalize_optional_notes(value)

    @model_validator(mode="after")
    def reject_null_completion(
        self,
    ) -> "ExerciseExecutionUpdateRequest":
        if "completed" in self.model_fields_set and self.completed is None:
            raise ValueError("Completed must not be null when provided.")

        return self


class SetExecutionCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    repetitions: int = Field(
        ge=1,
    )
    load: Decimal | None = Field(
        default=None,
        ge=0,
        max_digits=8,
        decimal_places=2,
    )
    load_unit: LoadUnit | None = None

    @model_validator(mode="after")
    def validate_load_configuration(
        self,
    ) -> "SetExecutionCreateRequest":
        if (self.load is None) != (self.load_unit is None):
            raise ValueError("Load and load unit must be provided together.")

        return self


class SetExecutionUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    repetitions: int | None = Field(
        default=None,
        ge=1,
    )
    load: Decimal | None = Field(
        default=None,
        ge=0,
        max_digits=8,
        decimal_places=2,
    )
    load_unit: LoadUnit | None = None

    @model_validator(mode="after")
    def validate_update(
        self,
    ) -> "SetExecutionUpdateRequest":
        fields_set = self.model_fields_set

        if "repetitions" in fields_set and self.repetitions is None:
            raise ValueError("Repetitions must not be null when provided.")

        if (
            "load" in fields_set
            and "load_unit" in fields_set
            and (self.load is None) != (self.load_unit is None)
        ):
            raise ValueError("Load and load unit must be provided together.")

        return self


class SetExecutionResponse(BaseModel):
    id: UUID
    position: int
    repetitions: int
    load: Decimal | None
    load_unit: LoadUnit | None
    created_at: datetime
    updated_at: datetime


class ExerciseExecutionResponse(BaseModel):
    id: UUID
    exercise_id: UUID | None
    exercise_name: str
    position: int
    planned_sets: int | None
    planned_repetitions: int | None
    planned_load: Decimal | None
    planned_load_unit: LoadUnit | None
    planned_notes: str | None
    notes: str | None
    is_completed: bool
    completed_at: datetime | None
    sets: list[SetExecutionResponse]
    created_at: datetime
    updated_at: datetime


class WorkoutSessionResponse(BaseModel):
    id: UUID
    source_workout_id: UUID | None
    workout_name: str
    status: WorkoutSessionStatus
    notes: str | None
    started_at: datetime
    completed_at: datetime | None
    cancelled_at: datetime | None
    exercises: list[ExerciseExecutionResponse]
    created_at: datetime
    updated_at: datetime
