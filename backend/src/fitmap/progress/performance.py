from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from fitmap.training.models import (
    ExerciseExecution,
    SetExecution,
    WorkoutSession,
)


@dataclass(frozen=True, slots=True)
class ExerciseLoadMaximum:
    load_unit: str
    max_load: Decimal


@dataclass(frozen=True, slots=True)
class ExercisePerformancePoint:
    workout_session_id: UUID
    completed_at: datetime
    performed_sets: int
    total_repetitions: int
    max_loads: tuple[ExerciseLoadMaximum, ...]


@dataclass(frozen=True, slots=True)
class ExercisePerformanceSeries:
    exercise_id: UUID
    exercise_name: str
    points: tuple[ExercisePerformancePoint, ...]


def _new_load_maximums() -> dict[str, Decimal]:
    return {}


@dataclass(slots=True)
class _MutablePerformancePoint:
    workout_session_id: UUID
    completed_at: datetime
    performed_sets: int = 0
    total_repetitions: int = 0
    max_loads: dict[str, Decimal] = field(
        default_factory=_new_load_maximums,
    )


def _new_performance_points() -> dict[UUID, _MutablePerformancePoint]:
    return {}


@dataclass(slots=True)
class _MutablePerformanceSeries:
    exercise_id: UUID
    exercise_name: str
    points: dict[UUID, _MutablePerformancePoint] = field(
        default_factory=_new_performance_points,
    )


def list_exercise_performance(
    *,
    db_session: Session,
    user_id: UUID,
) -> list[ExercisePerformanceSeries]:
    statement = (
        select(
            ExerciseExecution,
            WorkoutSession,
        )
        .join(
            WorkoutSession,
            ExerciseExecution.workout_session_id == WorkoutSession.id,
        )
        .where(
            WorkoutSession.user_id == user_id,
            WorkoutSession.status == "completed",
            ExerciseExecution.exercise_id.is_not(None),
        )
        .order_by(
            WorkoutSession.completed_at.asc(),
            WorkoutSession.id.asc(),
            ExerciseExecution.position.asc(),
        )
    )

    execution_rows = db_session.execute(statement).tuples().all()

    mutable_series_by_exercise: dict[
        UUID,
        _MutablePerformanceSeries,
    ] = {}

    for exercise_execution, workout_session in execution_rows:
        exercise_id = exercise_execution.exercise_id
        completed_at = workout_session.completed_at

        if exercise_id is None or completed_at is None:
            continue

        set_statement = (
            select(SetExecution)
            .where(
                SetExecution.exercise_execution_id == exercise_execution.id,
            )
            .order_by(
                SetExecution.position.asc(),
                SetExecution.id.asc(),
            )
        )

        performed_sets = list(
            db_session.scalars(set_statement).all(),
        )

        if not performed_sets:
            continue

        series = mutable_series_by_exercise.get(exercise_id)

        if series is None:
            series = _MutablePerformanceSeries(
                exercise_id=exercise_id,
                exercise_name=exercise_execution.exercise_name,
            )
            mutable_series_by_exercise[exercise_id] = series
        else:
            series.exercise_name = exercise_execution.exercise_name

        point = series.points.get(workout_session.id)

        if point is None:
            point = _MutablePerformancePoint(
                workout_session_id=workout_session.id,
                completed_at=completed_at,
            )
            series.points[workout_session.id] = point

        for performed_set in performed_sets:
            point.performed_sets += 1
            point.total_repetitions += performed_set.repetitions

            if performed_set.load is None or performed_set.load_unit is None:
                continue

            current_maximum = point.max_loads.get(
                performed_set.load_unit,
            )

            if current_maximum is None or performed_set.load > current_maximum:
                point.max_loads[performed_set.load_unit] = performed_set.load

    performance_series: list[ExercisePerformanceSeries] = []

    for series in mutable_series_by_exercise.values():
        points = sorted(
            series.points.values(),
            key=lambda point: (
                point.completed_at,
                str(point.workout_session_id),
            ),
        )

        if len(points) < 2:
            continue

        performance_series.append(
            ExercisePerformanceSeries(
                exercise_id=series.exercise_id,
                exercise_name=series.exercise_name,
                points=tuple(
                    ExercisePerformancePoint(
                        workout_session_id=point.workout_session_id,
                        completed_at=point.completed_at,
                        performed_sets=point.performed_sets,
                        total_repetitions=point.total_repetitions,
                        max_loads=tuple(
                            ExerciseLoadMaximum(
                                load_unit=load_unit,
                                max_load=max_load,
                            )
                            for load_unit, max_load in sorted(
                                point.max_loads.items(),
                            )
                        ),
                    )
                    for point in points
                ),
            )
        )

    return sorted(
        performance_series,
        key=lambda series: (
            series.exercise_name.casefold(),
            str(series.exercise_id),
        ),
    )
