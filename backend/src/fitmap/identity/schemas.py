import string
from datetime import datetime
from enum import StrEnum
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


def normalize_name(value: str) -> str:
    normalized = " ".join(value.split())

    if not normalized:
        raise ValueError("Name must not be blank.")

    return normalized


class FitnessGoal(StrEnum):
    MUSCLE_GAIN = "muscle_gain"
    STRENGTH = "strength"
    GENERAL_FITNESS = "general_fitness"
    ENDURANCE = "endurance"
    FAT_LOSS = "fat_loss"


class ExperienceLevel(StrEnum):
    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"


class MeasurementSystem(StrEnum):
    METRIC = "metric"
    IMPERIAL = "imperial"


class RegisterRequest(BaseModel):
    name: str = Field(
        min_length=1,
        max_length=120,
    )
    email: EmailStr
    password: str = Field(
        min_length=8,
        max_length=128,
    )

    @field_validator("name")
    @classmethod
    def normalize_name_field(cls, value: str) -> str:
        return normalize_name(value)

    @field_validator("password")
    @classmethod
    def validate_password_policy(cls, value: str) -> str:
        # A mesma composição é exigida no cadastro mobile; não afeta o Login.
        if not any("A" <= char <= "Z" for char in value):
            raise ValueError("Password must contain an uppercase letter (A-Z).")
        if not any("a" <= char <= "z" for char in value):
            raise ValueError("Password must contain a lowercase letter (a-z).")
        if not any("0" <= char <= "9" for char in value):
            raise ValueError("Password must contain a digit (0-9).")
        if not any(char in string.punctuation for char in value):
            raise ValueError("Password must contain an ASCII special character.")
        return value


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(
        min_length=1,
        max_length=128,
    )


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    email: EmailStr
    created_at: datetime


class ProfileResponse(BaseModel):
    id: UUID
    name: str
    email: EmailStr
    created_at: datetime
    fitness_goal: FitnessGoal | None = None
    experience_level: ExperienceLevel | None = None
    weekly_workout_goal: int | None = None
    preferred_workout_duration_minutes: int | None = None
    measurement_system: MeasurementSystem | None = None


class ProfileUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(
        default=None,
        min_length=1,
        max_length=120,
    )
    fitness_goal: FitnessGoal | None = None
    experience_level: ExperienceLevel | None = None
    weekly_workout_goal: int | None = Field(
        default=None,
        ge=1,
        le=7,
    )
    preferred_workout_duration_minutes: int | None = Field(
        default=None,
        ge=15,
        le=180,
    )
    measurement_system: MeasurementSystem | None = None

    @field_validator("name")
    @classmethod
    def normalize_optional_name_field(
        cls,
        value: str | None,
    ) -> str | None:
        if value is None:
            raise ValueError("Name must not be null.")

        return normalize_name(value)


class TokenResponse(BaseModel):
    access_token: str
    access_token_expires_at: datetime
    refresh_token: str
    refresh_token_expires_at: datetime
    token_type: str = "bearer"


class AuthResponse(BaseModel):
    user: UserResponse
    tokens: TokenResponse


class RefreshRequest(BaseModel):
    refresh_token: str = Field(
        min_length=1,
        max_length=512,
    )
