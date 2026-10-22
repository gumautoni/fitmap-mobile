from datetime import UTC, datetime
from decimal import Decimal
from types import SimpleNamespace
from uuid import uuid4

import pytest
from pydantic import ValidationError

from fitmap.progress.goal_schemas import (
    FitnessGoalCreateRequest,
    FitnessGoalResponse,
)
from fitmap.progress.schemas import BodyMetricType, BodyMetricUnit


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
def test_accepts_supported_fitness_goals(
    metric_type: str,
    unit: str,
) -> None:
    goal = FitnessGoalCreateRequest.model_validate(
        {
            "metric_type": metric_type,
            "target_value": "75.50",
            "unit": unit,
        }
    )

    assert goal.metric_type == BodyMetricType(metric_type)
    assert goal.target_value == Decimal("75.50")
    assert goal.unit == BodyMetricUnit(unit)


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
def test_rejects_incompatible_goal_units(
    metric_type: str,
    unit: str,
) -> None:
    with pytest.raises(
        ValidationError,
        match="Goal unit is incompatible",
    ):
        FitnessGoalCreateRequest.model_validate(
            {
                "metric_type": metric_type,
                "target_value": "75.50",
                "unit": unit,
            }
        )


@pytest.mark.parametrize(
    "target_value",
    [
        "0",
        "-1",
        "12.345",
        "123456789.00",
        "NaN",
    ],
)
def test_rejects_invalid_goal_targets(
    target_value: str,
) -> None:
    with pytest.raises(ValidationError):
        FitnessGoalCreateRequest.model_validate(
            {
                "metric_type": "weight",
                "target_value": target_value,
                "unit": "kg",
            }
        )


def test_rejects_unsupported_goal_metric() -> None:
    with pytest.raises(ValidationError):
        FitnessGoalCreateRequest.model_validate(
            {
                "metric_type": "bmi",
                "target_value": "22.00",
                "unit": "kg",
            }
        )


def test_rejects_client_provided_user_id() -> None:
    with pytest.raises(ValidationError):
        FitnessGoalCreateRequest.model_validate(
            {
                "metric_type": "weight",
                "target_value": "75.00",
                "unit": "kg",
                "user_id": str(uuid4()),
            }
        )


def test_requires_target_value_and_unit() -> None:
    with pytest.raises(ValidationError):
        FitnessGoalCreateRequest.model_validate(
            {
                "metric_type": "weight",
            }
        )


def test_fitness_goal_response_uses_orm_attributes() -> None:
    goal_id = uuid4()
    user_id = uuid4()
    timestamp = datetime(
        2026,
        10,
        21,
        16,
        0,
        tzinfo=UTC,
    )

    goal = SimpleNamespace(
        id=goal_id,
        user_id=user_id,
        metric_type="weight",
        target_value=Decimal("75.00"),
        unit="kg",
        created_at=timestamp,
        updated_at=timestamp,
    )

    response = FitnessGoalResponse.model_validate(goal)
    payload = response.model_dump(mode="json")

    assert payload["id"] == str(goal_id)
    assert payload["metric_type"] == "weight"
    assert payload["target_value"] == "75.00"
    assert payload["unit"] == "kg"
    assert "user_id" not in payload
