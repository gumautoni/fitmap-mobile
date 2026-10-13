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


def normalize_training_name(value: str) -> str:
    normalized = " ".join(value.split())

    if not normalized:
        raise ValueError("Name must not be blank.")

    return normalized


def normalize_optional_notes(
    value: str | None,
) -> str | None:
    if value is None:
        return None

    normalized = value.strip()

    return normalized or None


class ExerciseOrigin(StrEnum):
    CATALOG = "catalog"
    CUSTOM = "custom"


class LoadUnit(StrEnum):
    KG = "kg"
    LB = "lb"


class CustomExerciseCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(
        min_length=1,
        max_length=120,
    )

    @field_validator("name")
    @classmethod
    def normalize_name_field(
        cls,
        value: str,
    ) -> str:
        return normalize_training_name(value)


class ExerciseResponse(BaseModel):
    id: UUID
    name: str
    origin: ExerciseOrigin
    is_archived: bool
    created_at: datetime
    updated_at: datetime


class WorkoutCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(
        min_length=1,
        max_length=120,
    )

    @field_validator("name")
    @classmethod
    def normalize_name_field(
        cls,
        value: str,
    ) -> str:
        return normalize_training_name(value)


class WorkoutUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(
        default=None,
        min_length=1,
        max_length=120,
    )

    @field_validator("name")
    @classmethod
    def normalize_name_field(
        cls,
        value: str | None,
    ) -> str:
        if value is None:
            raise ValueError("Workout name must not be null.")

        return normalize_training_name(value)


class WorkoutExerciseCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    exercise_id: UUID
    target_sets: int | None = Field(
        default=None,
        ge=1,
    )
    target_repetitions: int | None = Field(
        default=None,
        ge=1,
    )
    target_load: Decimal | None = Field(
        default=None,
        ge=0,
        max_digits=8,
        decimal_places=2,
    )
    target_load_unit: LoadUnit | None = None
    notes: str | None = None

    @field_validator("notes")
    @classmethod
    def normalize_notes_field(
        cls,
        value: str | None,
    ) -> str | None:
        return normalize_optional_notes(value)

    @model_validator(mode="after")
    def validate_load_configuration(
        self,
    ) -> "WorkoutExerciseCreateRequest":
        if (self.target_load is None) != (self.target_load_unit is None):
            raise ValueError("Target load and target load unit must be provided together.")

        return self


class WorkoutExerciseUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    target_sets: int | None = Field(
        default=None,
        ge=1,
    )
    target_repetitions: int | None = Field(
        default=None,
        ge=1,
    )
    target_load: Decimal | None = Field(
        default=None,
        ge=0,
        max_digits=8,
        decimal_places=2,
    )
    target_load_unit: LoadUnit | None = None
    notes: str | None = None

    @field_validator("notes")
    @classmethod
    def normalize_notes_field(
        cls,
        value: str | None,
    ) -> str | None:
        return normalize_optional_notes(value)

    @model_validator(mode="after")
    def validate_explicit_load_configuration(
        self,
    ) -> "WorkoutExerciseUpdateRequest":
        fields_set = self.model_fields_set

        if (
            "target_load" in fields_set
            and "target_load_unit" in fields_set
            and (self.target_load is None) != (self.target_load_unit is None)
        ):
            raise ValueError("Target load and target load unit must be provided together.")

        return self


class WorkoutExerciseResponse(BaseModel):
    id: UUID
    exercise_id: UUID
    exercise_name: str
    position: int
    target_sets: int | None
    target_repetitions: int | None
    target_load: Decimal | None
    target_load_unit: LoadUnit | None
    notes: str | None
    created_at: datetime
    updated_at: datetime


class WorkoutSummaryResponse(BaseModel):
    id: UUID
    name: str
    is_archived: bool
    archived_at: datetime | None
    created_at: datetime
    updated_at: datetime


class WorkoutResponse(WorkoutSummaryResponse):
    exercises: list[WorkoutExerciseResponse]


class WorkoutReorderRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    workout_exercise_ids: list[UUID] = Field(
        min_length=1,
    )

    @field_validator("workout_exercise_ids")
    @classmethod
    def reject_duplicate_ids(
        cls,
        value: list[UUID],
    ) -> list[UUID]:
        if len(value) != len(set(value)):
            raise ValueError("Workout exercise IDs must be unique.")

        return value
