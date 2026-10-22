from datetime import UTC, datetime
from decimal import Decimal
from types import SimpleNamespace
from uuid import uuid4

import pytest
from pydantic import ValidationError

from fitmap.progress.schemas import (
    BodyMetricCreateRequest,
    BodyMetricResponse,
    BodyMetricType,
    BodyMetricUnit,
)


def build_metric_payload(
    *,
    metric_type: str = "weight",
    value: str = "78.50",
    unit: str = "kg",
    recorded_at: str = "2026-10-21T10:00:00-03:00",
) -> dict[str, str]:
    return {
        "metric_type": metric_type,
        "value": value,
        "unit": unit,
        "recorded_at": recorded_at,
    }


@pytest.mark.parametrize(
    ("metric_type", "unit"),
    [
        ("weight", "kg"),
        ("weight", "lb"),
        ("waist", "cm"),
        ("waist", "in"),
        ("chest", "cm"),
        ("chest", "in"),
        ("arm", "cm"),
        ("arm", "in"),
        ("thigh", "cm"),
        ("thigh", "in"),
        ("hip", "cm"),
        ("hip", "in"),
    ],
)
def test_accepts_supported_metric_and_unit_combinations(
    metric_type: str,
    unit: str,
) -> None:
    payload = build_metric_payload(
        metric_type=metric_type,
        unit=unit,
    )

    record = BodyMetricCreateRequest.model_validate(payload)

    assert record.metric_type == BodyMetricType(metric_type)
    assert record.unit == BodyMetricUnit(unit)
    assert record.value == Decimal("78.50")
    assert record.recorded_at.tzinfo is not None


@pytest.mark.parametrize(
    ("metric_type", "unit"),
    [
        ("weight", "cm"),
        ("weight", "in"),
        ("waist", "kg"),
        ("chest", "lb"),
        ("arm", "kg"),
        ("thigh", "lb"),
        ("hip", "kg"),
    ],
)
def test_rejects_incompatible_metric_and_unit_combinations(
    metric_type: str,
    unit: str,
) -> None:
    payload = build_metric_payload(
        metric_type=metric_type,
        unit=unit,
    )

    with pytest.raises(
        ValidationError,
        match="Measurement unit is incompatible",
    ):
        BodyMetricCreateRequest.model_validate(payload)


@pytest.mark.parametrize(
    "value",
    [
        "0",
        "-1",
        "-0.01",
        "12.345",
        "123456789.00",
        "NaN",
    ],
)
def test_rejects_invalid_metric_values(
    value: str,
) -> None:
    payload = build_metric_payload(value=value)

    with pytest.raises(ValidationError):
        BodyMetricCreateRequest.model_validate(payload)


def test_rejects_unsupported_metric_type() -> None:
    payload = build_metric_payload(metric_type="bmi")

    with pytest.raises(ValidationError):
        BodyMetricCreateRequest.model_validate(payload)


def test_requires_timezone_aware_recorded_at() -> None:
    payload = build_metric_payload(
        recorded_at="2026-10-21T10:00:00",
    )

    with pytest.raises(ValidationError):
        BodyMetricCreateRequest.model_validate(payload)


def test_rejects_client_provided_user_id() -> None:
    payload = {
        **build_metric_payload(),
        "user_id": str(uuid4()),
    }

    with pytest.raises(
        ValidationError,
        match="Extra inputs are not permitted",
    ):
        BodyMetricCreateRequest.model_validate(payload)


def test_rejects_missing_required_fields() -> None:
    with pytest.raises(ValidationError):
        BodyMetricCreateRequest.model_validate(
            {
                "metric_type": "weight",
                "value": "78.50",
            }
        )


def test_body_metric_response_uses_orm_attributes() -> None:
    record_id = uuid4()
    owner_id = uuid4()
    recorded_at = datetime(
        2026,
        10,
        21,
        13,
        0,
        tzinfo=UTC,
    )

    record = SimpleNamespace(
        id=record_id,
        user_id=owner_id,
        metric_type="weight",
        value=Decimal("78.50"),
        unit="kg",
        recorded_at=recorded_at,
        created_at=recorded_at,
        updated_at=recorded_at,
    )

    response = BodyMetricResponse.model_validate(record)
    payload = response.model_dump(mode="json")

    assert payload["id"] == str(record_id)
    assert payload["metric_type"] == "weight"
    assert payload["value"] == "78.50"
    assert payload["unit"] == "kg"
    assert payload["recorded_at"] == "2026-10-21T13:00:00Z"

    assert "user_id" not in payload
