from collections.abc import Iterable
from dataclasses import dataclass
from datetime import UTC, datetime
from decimal import ROUND_DOWN, Decimal
from typing import Literal

from fitmap.progress.goal_models import FitnessGoal
from fitmap.progress.models import BodyMetricRecord

GoalProgressStatus = Literal[
    "insufficient_data",
    "not_calculable",
    "in_progress",
    "achieved",
]

_KG_PER_LB = Decimal("0.45359237")
_CM_PER_IN = Decimal("2.54")
_PERCENT_QUANTUM = Decimal("0.01")
_HUNDRED = Decimal("100")


@dataclass(frozen=True, slots=True)
class FitnessGoalProgress:
    status: GoalProgressStatus
    baseline_value: Decimal | None
    current_value: Decimal | None
    progress_percent: Decimal | None


def convert_measurement(
    *,
    value: Decimal,
    from_unit: str,
    to_unit: str,
) -> Decimal:
    if from_unit == to_unit:
        if from_unit not in {"kg", "lb", "cm", "in"}:
            raise ValueError("Unsupported measurement unit.")
        return value

    if from_unit == "lb" and to_unit == "kg":
        return value * _KG_PER_LB

    if from_unit == "kg" and to_unit == "lb":
        return value / _KG_PER_LB

    if from_unit == "in" and to_unit == "cm":
        return value * _CM_PER_IN

    if from_unit == "cm" and to_unit == "in":
        return value / _CM_PER_IN

    raise ValueError("Incompatible measurement units.")


def calculate_fitness_goal_progress(
    *,
    goal: FitnessGoal,
    measurements: Iterable[BodyMetricRecord],
    as_of: datetime | None = None,
) -> FitnessGoalProgress:
    reference_time = as_of if as_of is not None else datetime.now(UTC)

    if reference_time.tzinfo is None or reference_time.utcoffset() is None:
        raise ValueError("Reference time must include a timezone.")

    relevant_measurements = sorted(
        (
            measurement
            for measurement in measurements
            if measurement.user_id == goal.user_id
            and measurement.metric_type == goal.metric_type
            and measurement.recorded_at <= reference_time
        ),
        key=lambda measurement: measurement.recorded_at,
    )

    if not relevant_measurements:
        return FitnessGoalProgress(
            status="insufficient_data",
            baseline_value=None,
            current_value=None,
            progress_percent=None,
        )

    previous_measurements = [
        measurement
        for measurement in relevant_measurements
        if measurement.recorded_at <= goal.created_at
    ]

    baseline = previous_measurements[-1] if previous_measurements else relevant_measurements[0]

    baseline_value = convert_measurement(
        value=baseline.value,
        from_unit=baseline.unit,
        to_unit=goal.unit,
    )

    minimum_current_date = max(
        goal.created_at,
        baseline.recorded_at,
    )

    subsequent_measurements = [
        measurement
        for measurement in relevant_measurements
        if measurement.recorded_at > minimum_current_date
    ]

    if not subsequent_measurements:
        return FitnessGoalProgress(
            status="insufficient_data",
            baseline_value=baseline_value,
            current_value=None,
            progress_percent=None,
        )

    current = subsequent_measurements[-1]

    current_value = convert_measurement(
        value=current.value,
        from_unit=current.unit,
        to_unit=goal.unit,
    )

    target_distance = goal.target_value - baseline_value

    if target_distance == 0:
        return FitnessGoalProgress(
            status="not_calculable",
            baseline_value=baseline_value,
            current_value=current_value,
            progress_percent=None,
        )

    completed_distance = current_value - baseline_value

    raw_progress = (completed_distance / target_distance) * _HUNDRED

    bounded_progress = max(
        Decimal("0"),
        min(_HUNDRED, raw_progress),
    )

    progress_percent = bounded_progress.quantize(
        _PERCENT_QUANTUM,
        rounding=ROUND_DOWN,
    )

    status: GoalProgressStatus = "achieved" if raw_progress >= _HUNDRED else "in_progress"

    return FitnessGoalProgress(
        status=status,
        baseline_value=baseline_value,
        current_value=current_value,
        progress_percent=progress_percent,
    )
