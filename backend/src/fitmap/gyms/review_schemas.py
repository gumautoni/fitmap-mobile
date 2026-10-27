from datetime import datetime
from decimal import Decimal
from enum import StrEnum
from typing import Self
from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_validator,
)


class GymReviewReportReason(StrEnum):
    SPAM = "spam"
    OFFENSIVE = "offensive"
    MISLEADING = "misleading"
    OTHER = "other"


def normalize_optional_review_text(
    value: str | None,
    *,
    field_name: str,
) -> str | None:
    if value is None:
        return None

    normalized = value.strip()

    if not normalized:
        raise ValueError(f"{field_name} must not be blank.")

    return normalized


class GymReviewCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    rating: int = Field(
        ge=1,
        le=5,
        strict=True,
    )

    comment: str | None = Field(
        default=None,
        max_length=1000,
    )

    @field_validator("comment")
    @classmethod
    def validate_comment(
        cls,
        value: str | None,
    ) -> str | None:
        return normalize_optional_review_text(
            value,
            field_name="Review comment",
        )


class GymReviewUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    rating: int | None = Field(
        default=None,
        ge=1,
        le=5,
        strict=True,
    )

    comment: str | None = Field(
        default=None,
        max_length=1000,
    )

    @field_validator("comment")
    @classmethod
    def validate_comment(
        cls,
        value: str | None,
    ) -> str | None:
        return normalize_optional_review_text(
            value,
            field_name="Review comment",
        )

    @model_validator(mode="after")
    def validate_update_fields(self) -> Self:
        if not self.model_fields_set:
            raise ValueError("At least one review field must be provided.")

        if "rating" in self.model_fields_set and self.rating is None:
            raise ValueError("Review rating must not be null.")

        return self


class GymReviewResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    gym_id: UUID
    rating: int
    comment: str | None
    created_at: datetime
    updated_at: datetime


class GymRatingSummaryResponse(BaseModel):
    gym_id: UUID
    average_rating: Decimal | None
    review_count: int = Field(ge=0)


class GymReviewListResponse(BaseModel):
    summary: GymRatingSummaryResponse
    reviews: list[GymReviewResponse]


class GymReviewReportCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    reason: GymReviewReportReason

    details: str | None = Field(
        default=None,
        max_length=500,
    )

    @field_validator("details")
    @classmethod
    def validate_details(
        cls,
        value: str | None,
    ) -> str | None:
        return normalize_optional_review_text(
            value,
            field_name="Report details",
        )


class GymReviewReportResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    review_id: UUID
    reason: GymReviewReportReason
    created_at: datetime
