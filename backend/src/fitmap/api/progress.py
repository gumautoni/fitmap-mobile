from fastapi import APIRouter

from fitmap.api.dependencies import (
    CurrentIdentityDependency,
    DatabaseSessionDependency,
)
from fitmap.progress.performance import list_exercise_performance
from fitmap.progress.schemas import (
    BasicProgressStatisticsResponse,
    ExerciseLoadMaximumResponse,
    ExercisePerformancePointResponse,
    ExercisePerformanceResponse,
)
from fitmap.progress.statistics import get_basic_progress_statistics
from fitmap.training.schemas import LoadUnit

router = APIRouter(
    prefix="/progress",
    tags=["progress"],
)


@router.get(
    "/statistics",
    response_model=BasicProgressStatisticsResponse,
)
def get_progress_statistics(
    identity: CurrentIdentityDependency,
    db_session: DatabaseSessionDependency,
) -> BasicProgressStatisticsResponse:
    statistics = get_basic_progress_statistics(
        db_session=db_session,
        user_id=identity.user.id,
    )

    return BasicProgressStatisticsResponse(
        completed_workouts=statistics.completed_workouts,
        completed_workouts_last_7_days=statistics.completed_workouts_last_7_days,
        completed_workouts_last_30_days=statistics.completed_workouts_last_30_days,
        training_days_last_30_days=statistics.training_days_last_30_days,
        total_performed_sets=statistics.total_performed_sets,
    )


@router.get(
    "/exercises/performance",
    response_model=list[ExercisePerformanceResponse],
)
def get_exercise_performance(
    identity: CurrentIdentityDependency,
    db_session: DatabaseSessionDependency,
) -> list[ExercisePerformanceResponse]:
    performance_series = list_exercise_performance(
        db_session=db_session,
        user_id=identity.user.id,
    )

    return [
        ExercisePerformanceResponse(
            exercise_id=series.exercise_id,
            exercise_name=series.exercise_name,
            points=[
                ExercisePerformancePointResponse(
                    workout_session_id=point.workout_session_id,
                    completed_at=point.completed_at,
                    performed_sets=point.performed_sets,
                    total_repetitions=point.total_repetitions,
                    max_loads=[
                        ExerciseLoadMaximumResponse(
                            load_unit=LoadUnit(load.load_unit),
                            max_load=load.max_load,
                        )
                        for load in point.max_loads
                    ],
                )
                for point in series.points
            ],
        )
        for series in performance_series
    ]
