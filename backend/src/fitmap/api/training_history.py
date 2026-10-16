from fitmap.api.dependencies import (
    CurrentIdentityDependency,
    DatabaseSessionDependency,
)
from fitmap.training.history import list_workout_history
from fitmap.training.history_schemas import (
    WorkoutHistorySummaryResponse,
)
from fitmap.training.models import WorkoutSession

from fastapi import APIRouter

router = APIRouter(
    prefix="/training",
    tags=["training"],
)


@router.get(
    "/history",
    response_model=list[WorkoutHistorySummaryResponse],
)
def get_workout_history(
    identity: CurrentIdentityDependency,
    db_session: DatabaseSessionDependency,
) -> list[WorkoutHistorySummaryResponse]:
    workout_sessions = list_workout_history(
        db_session=db_session,
        user_id=identity.user.id,
    )

    return [
        _build_history_summary_response(workout_session) for workout_session in workout_sessions
    ]


def _build_history_summary_response(
    workout_session: WorkoutSession,
) -> WorkoutHistorySummaryResponse:
    if workout_session.completed_at is None:
        raise RuntimeError("Completed workout session has no completion timestamp.")

    return WorkoutHistorySummaryResponse(
        id=workout_session.id,
        source_workout_id=workout_session.source_workout_id,
        workout_name=workout_session.workout_name,
        notes=workout_session.notes,
        started_at=workout_session.started_at,
        completed_at=workout_session.completed_at,
        created_at=workout_session.created_at,
        updated_at=workout_session.updated_at,
    )
