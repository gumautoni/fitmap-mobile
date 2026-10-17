from fastapi import APIRouter

from fitmap.api.dependencies import (
    CurrentIdentityDependency,
    DatabaseSessionDependency,
)
from fitmap.progress.schemas import BasicProgressStatisticsResponse
from fitmap.progress.statistics import get_basic_progress_statistics

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
