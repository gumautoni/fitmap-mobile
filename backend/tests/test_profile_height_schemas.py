from datetime import UTC, datetime
from decimal import Decimal
from uuid import uuid4

import pytest
from pydantic import ValidationError

from fitmap.identity.schemas import ProfileResponse, ProfileUpdateRequest


@pytest.mark.parametrize(
    "height",
    ["50", "170.5", "250.00"],
)
def test_height_schema_accepts_valid_values(height: str) -> None:
    payload = ProfileUpdateRequest.model_validate({"height_cm": height})

    assert payload.height_cm == Decimal(height)
    assert "height_cm" in payload.model_fields_set


@pytest.mark.parametrize(
    "height",
    ["0", "49.99", "250.01", "170.555", "NaN", "Infinity", "abc"],
)
def test_height_schema_rejects_invalid_values(height: str) -> None:
    with pytest.raises(ValidationError):
        ProfileUpdateRequest.model_validate({"height_cm": height})


def test_height_schema_distinguishes_omission_and_clearing() -> None:
    omitted = ProfileUpdateRequest.model_validate({})
    cleared = ProfileUpdateRequest.model_validate({"height_cm": None})

    assert omitted.height_cm is None
    assert cleared.height_cm is None
    assert "height_cm" not in omitted.model_fields_set
    assert "height_cm" in cleared.model_fields_set


def test_profile_response_serializes_height() -> None:
    response = ProfileResponse(
        id=uuid4(),
        name="FitMap Test",
        email="fitmap-test@example.com",
        created_at=datetime(2026, 11, 11, tzinfo=UTC),
        height_cm=Decimal("170.50"),
    )

    payload = response.model_dump(mode="json")

    assert payload["height_cm"] == "170.50"
    assert payload["id"] == str(response.id)
