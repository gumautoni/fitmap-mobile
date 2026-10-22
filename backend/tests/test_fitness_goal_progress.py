from datetime import UTC, datetime
from decimal import Decimal
from uuid import UUID, uuid4

import pytest

from fitmap.progress.goal_models import FitnessGoal
from fitmap.progress.goal_progress import (
    calculate_fitness_goal_progress,
    convert_measurement,
)
from fitmap.progress.models import BodyMetricRecord

REFERENCE_DATE = datetime(2026, 10, 21, tzinfo=UTC)
CREATED_DATE = datetime(2026, 10, 10, tzinfo=UTC)


def build_goal(
    *,
    user_id: UUID | None = None,
    metric_type: str = "weight",
    target_value: str = "75.00",
    unit: str = "kg",
) -> FitnessGoal:
    return FitnessGoal(
        user_id=user_id or uuid4(),
        metric_type=metric_type,
        target_value=Decimal(target_value),
        unit=unit,
        created_at=CREATED_DATE,
    )


def build_measurement(
    *,
    goal: FitnessGoal,
    value: str,
    recorded_at: datetime,
    metric_type: str | None = None,
    unit: str = "kg",
    user_id: UUID | None = None,
) -> BodyMetricRecord:
    return BodyMetricRecord(
        user_id=user_id or goal.user_id,
        metric_type=metric_type or goal.metric_type,
        value=Decimal(value),
        unit=unit,
        recorded_at=recorded_at,
    )


def test_goal_without_measurements_has_no_progress() -> None:
    goal = build_goal()

    progress = calculate_fitness_goal_progress(
        goal=goal,
        measurements=[],
        as_of=REFERENCE_DATE,
    )

    assert progress.status == "insufficient_data"
    assert progress.baseline_value is None
    assert progress.current_value is None
    assert progress.progress_percent is None


def test_goal_with_only_baseline_has_no_progress() -> None:
    goal = build_goal()
    baseline = build_measurement(
        goal=goal,
        value="80.00",
        recorded_at=datetime(2026, 10, 5, tzinfo=UTC),
    )

    progress = calculate_fitness_goal_progress(
        goal=goal,
        measurements=[baseline],
        as_of=REFERENCE_DATE,
    )

    assert progress.status == "insufficient_data"
    assert progress.baseline_value == Decimal("80.00")
    assert progress.current_value is None
    assert progress.progress_percent is None


def test_older_measurements_alone_do_not_create_progress() -> None:
    goal = build_goal()

    measurements = [
        build_measurement(
            goal=goal,
            value="82.00",
            recorded_at=datetime(2026, 10, 1, tzinfo=UTC),
        ),
        build_measurement(
            goal=goal,
            value="80.00",
            recorded_at=datetime(2026, 10, 5, tzinfo=UTC),
        ),
    ]

    progress = calculate_fitness_goal_progress(
        goal=goal,
        measurements=measurements,
        as_of=REFERENCE_DATE,
    )

    assert progress.status == "insufficient_data"
    assert progress.baseline_value == Decimal("80.00")
    assert progress.progress_percent is None


def test_weight_reduction_progress_is_calculated() -> None:
    goal = build_goal()

    measurements = [
        build_measurement(
            goal=goal,
            value="80.00",
            recorded_at=datetime(2026, 10, 5, tzinfo=UTC),
        ),
        build_measurement(
            goal=goal,
            value="78.00",
            recorded_at=datetime(2026, 10, 15, tzinfo=UTC),
        ),
    ]

    progress = calculate_fitness_goal_progress(
        goal=goal,
        measurements=measurements,
        as_of=REFERENCE_DATE,
    )

    assert progress.status == "in_progress"
    assert progress.baseline_value == Decimal("80.00")
    assert progress.current_value == Decimal("78.00")
    assert progress.progress_percent == Decimal("40.00")


def test_increase_goal_progress_is_calculated() -> None:
    goal = build_goal(
        metric_type="arm",
        target_value="40.00",
        unit="cm",
    )

    measurements = [
        build_measurement(
            goal=goal,
            value="36.00",
            unit="cm",
            recorded_at=datetime(2026, 10, 5, tzinfo=UTC),
        ),
        build_measurement(
            goal=goal,
            value="38.00",
            unit="cm",
            recorded_at=datetime(2026, 10, 15, tzinfo=UTC),
        ),
    ]

    progress = calculate_fitness_goal_progress(
        goal=goal,
        measurements=measurements,
        as_of=REFERENCE_DATE,
    )

    assert progress.status == "in_progress"
    assert progress.progress_percent == Decimal("50.00")


def test_goal_reached_has_full_progress() -> None:
    goal = build_goal()

    measurements = [
        build_measurement(
            goal=goal,
            value="80.00",
            recorded_at=datetime(2026, 10, 5, tzinfo=UTC),
        ),
        build_measurement(
            goal=goal,
            value="75.00",
            recorded_at=datetime(2026, 10, 15, tzinfo=UTC),
        ),
    ]

    progress = calculate_fitness_goal_progress(
        goal=goal,
        measurements=measurements,
        as_of=REFERENCE_DATE,
    )

    assert progress.status == "achieved"
    assert progress.progress_percent == Decimal("100.00")


def test_exceeding_target_is_capped_at_100_percent() -> None:
    goal = build_goal()

    measurements = [
        build_measurement(
            goal=goal,
            value="80.00",
            recorded_at=datetime(2026, 10, 5, tzinfo=UTC),
        ),
        build_measurement(
            goal=goal,
            value="73.00",
            recorded_at=datetime(2026, 10, 15, tzinfo=UTC),
        ),
    ]

    progress = calculate_fitness_goal_progress(
        goal=goal,
        measurements=measurements,
        as_of=REFERENCE_DATE,
    )

    assert progress.status == "achieved"
    assert progress.progress_percent == Decimal("100.00")


def test_moving_away_from_target_is_capped_at_zero() -> None:
    goal = build_goal()

    measurements = [
        build_measurement(
            goal=goal,
            value="80.00",
            recorded_at=datetime(2026, 10, 5, tzinfo=UTC),
        ),
        build_measurement(
            goal=goal,
            value="82.00",
            recorded_at=datetime(2026, 10, 15, tzinfo=UTC),
        ),
    ]

    progress = calculate_fitness_goal_progress(
        goal=goal,
        measurements=measurements,
        as_of=REFERENCE_DATE,
    )

    assert progress.status == "in_progress"
    assert progress.progress_percent == Decimal("0.00")


def test_target_equal_to_baseline_has_no_percentage() -> None:
    goal = build_goal(target_value="80.00")

    measurements = [
        build_measurement(
            goal=goal,
            value="80.00",
            recorded_at=datetime(2026, 10, 5, tzinfo=UTC),
        ),
        build_measurement(
            goal=goal,
            value="79.00",
            recorded_at=datetime(2026, 10, 15, tzinfo=UTC),
        ),
    ]

    progress = calculate_fitness_goal_progress(
        goal=goal,
        measurements=measurements,
        as_of=REFERENCE_DATE,
    )

    assert progress.status == "not_calculable"
    assert progress.progress_percent is None


def test_first_measurement_after_goal_can_be_baseline() -> None:
    goal = build_goal()

    measurements = [
        build_measurement(
            goal=goal,
            value="80.00",
            recorded_at=datetime(2026, 10, 11, tzinfo=UTC),
        ),
        build_measurement(
            goal=goal,
            value="78.00",
            recorded_at=datetime(2026, 10, 15, tzinfo=UTC),
        ),
    ]

    progress = calculate_fitness_goal_progress(
        goal=goal,
        measurements=measurements,
        as_of=REFERENCE_DATE,
    )

    assert progress.status == "in_progress"
    assert progress.progress_percent == Decimal("40.00")


def test_same_timestamp_does_not_count_as_new_progress() -> None:
    goal = build_goal()

    measurements = [
        build_measurement(
            goal=goal,
            value="80.00",
            recorded_at=datetime(2026, 10, 11, tzinfo=UTC),
        ),
        build_measurement(
            goal=goal,
            value="78.00",
            recorded_at=datetime(2026, 10, 11, tzinfo=UTC),
        ),
    ]

    progress = calculate_fitness_goal_progress(
        goal=goal,
        measurements=measurements,
        as_of=REFERENCE_DATE,
    )

    assert progress.status == "insufficient_data"
    assert progress.progress_percent is None


def test_ignores_other_users_measurements() -> None:
    goal = build_goal()

    measurements = [
        build_measurement(
            goal=goal,
            value="80.00",
            recorded_at=datetime(2026, 10, 5, tzinfo=UTC),
        ),
        build_measurement(
            goal=goal,
            user_id=uuid4(),
            value="75.00",
            recorded_at=datetime(2026, 10, 15, tzinfo=UTC),
        ),
    ]

    progress = calculate_fitness_goal_progress(
        goal=goal,
        measurements=measurements,
        as_of=REFERENCE_DATE,
    )

    assert progress.status == "insufficient_data"
    assert progress.progress_percent is None


def test_ignores_other_metric_types() -> None:
    goal = build_goal()

    measurements = [
        build_measurement(
            goal=goal,
            value="80.00",
            recorded_at=datetime(2026, 10, 5, tzinfo=UTC),
        ),
        build_measurement(
            goal=goal,
            metric_type="waist",
            value="75.00",
            unit="cm",
            recorded_at=datetime(2026, 10, 15, tzinfo=UTC),
        ),
    ]

    progress = calculate_fitness_goal_progress(
        goal=goal,
        measurements=measurements,
        as_of=REFERENCE_DATE,
    )

    assert progress.status == "insufficient_data"
    assert progress.progress_percent is None


def test_ignores_future_measurements() -> None:
    goal = build_goal()

    measurements = [
        build_measurement(
            goal=goal,
            value="80.00",
            recorded_at=datetime(2026, 10, 5, tzinfo=UTC),
        ),
        build_measurement(
            goal=goal,
            value="75.00",
            recorded_at=datetime(2026, 11, 1, tzinfo=UTC),
        ),
    ]

    progress = calculate_fitness_goal_progress(
        goal=goal,
        measurements=measurements,
        as_of=REFERENCE_DATE,
    )

    assert progress.status == "insufficient_data"
    assert progress.progress_percent is None


def test_converts_inches_to_centimeters() -> None:
    result = convert_measurement(
        value=Decimal("38"),
        from_unit="in",
        to_unit="cm",
    )

    assert result == Decimal("96.52")


def test_converts_pounds_to_kilograms() -> None:
    result = convert_measurement(
        value=Decimal("200"),
        from_unit="lb",
        to_unit="kg",
    )

    assert result == Decimal("90.71847400")


def test_progress_converts_mixed_measurement_units() -> None:
    goal = build_goal(
        metric_type="waist",
        target_value="90.00",
        unit="cm",
    )

    measurements = [
        build_measurement(
            goal=goal,
            value="100.00",
            unit="cm",
            recorded_at=datetime(2026, 10, 5, tzinfo=UTC),
        ),
        build_measurement(
            goal=goal,
            value="38.00",
            unit="in",
            recorded_at=datetime(2026, 10, 15, tzinfo=UTC),
        ),
    ]

    progress = calculate_fitness_goal_progress(
        goal=goal,
        measurements=measurements,
        as_of=REFERENCE_DATE,
    )

    assert progress.status == "in_progress"
    assert progress.current_value == Decimal("96.52")
    assert progress.progress_percent == Decimal("34.80")


def test_rejects_incompatible_measurement_conversion() -> None:
    with pytest.raises(
        ValueError,
        match="Incompatible measurement units",
    ):
        convert_measurement(
            value=Decimal("80"),
            from_unit="kg",
            to_unit="cm",
        )


def test_rejects_naive_reference_datetime() -> None:
    goal = build_goal()

    with pytest.raises(
        ValueError,
        match="Reference time must include a timezone",
    ):
        calculate_fitness_goal_progress(
            goal=goal,
            measurements=[],
            as_of=datetime(2026, 10, 21),
        )
