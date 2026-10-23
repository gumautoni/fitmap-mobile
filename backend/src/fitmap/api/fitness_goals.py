from uuid import UUID

from fastapi import APIRouter, status

from fitmap.api.dependencies import (
    CurrentIdentityDependency,
    DatabaseSessionDependency,
)
from fitmap.api.errors import ApiError
from fitmap.progress.body_metrics import list_body_metric_records
from fitmap.progress.goal_progress import (
    calculate_fitness_goal_progress,
)
from fitmap.progress.goal_schemas import (
    FitnessGoalCreateRequest,
    FitnessGoalProgressResponse,
    FitnessGoalResponse,
)
from fitmap.progress.goals import (
    create_fitness_goal,
    get_owned_fitness_goal,
    list_fitness_goals,
)
from fitmap.progress.schemas import BodyMetricType

router = APIRouter(
    prefix="/progress/goals",
    tags=["progress"],
)


@router.post(
    "",
    response_model=FitnessGoalResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_goal(
    payload: FitnessGoalCreateRequest,
    identity: CurrentIdentityDependency,
    db_session: DatabaseSessionDependency,
) -> FitnessGoalResponse:
    goal = create_fitness_goal(
        db_session=db_session,
        user_id=identity.user.id,
        metric_type=payload.metric_type,
        target_value=payload.target_value,
        unit=payload.unit,
    )

    db_session.commit()
    db_session.refresh(goal)

    return FitnessGoalResponse.model_validate(goal)


@router.get(
    "",
    response_model=list[FitnessGoalResponse],
)
def get_goals(
    identity: CurrentIdentityDependency,
    db_session: DatabaseSessionDependency,
    metric_type: BodyMetricType | None = None,
) -> list[FitnessGoalResponse]:
    goals = list_fitness_goals(
        db_session=db_session,
        user_id=identity.user.id,
        metric_type=metric_type,
    )

    return [FitnessGoalResponse.model_validate(goal) for goal in goals]


@router.get(
    "/{goal_id}/progress",
    response_model=FitnessGoalProgressResponse,
)
def get_goal_progress(
    goal_id: UUID,
    identity: CurrentIdentityDependency,
    db_session: DatabaseSessionDependency,
) -> FitnessGoalProgressResponse:
    goal = get_owned_fitness_goal(
        db_session=db_session,
        user_id=identity.user.id,
        goal_id=goal_id,
    )

    if goal is None:
        raise ApiError(
            status_code=404,
            code="fitness_goal_not_found",
            message="Fitness goal was not found.",
        )

    measurements = list_body_metric_records(
        db_session=db_session,
        user_id=identity.user.id,
        metric_type=BodyMetricType(goal.metric_type),
    )

    progress = calculate_fitness_goal_progress(
        goal=goal,
        measurements=measurements,
    )

    return FitnessGoalProgressResponse(
        goal=FitnessGoalResponse.model_validate(goal),
        status=progress.status,
        baseline_value=progress.baseline_value,
        current_value=progress.current_value,
        progress_percent=progress.progress_percent,
    )
