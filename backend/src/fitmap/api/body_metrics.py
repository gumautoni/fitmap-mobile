from fastapi import APIRouter, status

from fitmap.api.dependencies import (
    CurrentIdentityDependency,
    DatabaseSessionDependency,
)
from fitmap.progress.body_metrics import (
    create_body_metric_record,
    list_body_metric_records,
)
from fitmap.progress.schemas import (
    BodyMetricCreateRequest,
    BodyMetricResponse,
    BodyMetricType,
)

router = APIRouter(
    prefix="/progress/body-metrics",
    tags=["progress"],
)


@router.post(
    "",
    response_model=BodyMetricResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_body_metric(
    payload: BodyMetricCreateRequest,
    identity: CurrentIdentityDependency,
    db_session: DatabaseSessionDependency,
) -> BodyMetricResponse:
    record = create_body_metric_record(
        db_session=db_session,
        user_id=identity.user.id,
        metric_type=payload.metric_type,
        value=payload.value,
        unit=payload.unit,
        recorded_at=payload.recorded_at,
    )

    db_session.commit()
    db_session.refresh(record)

    return BodyMetricResponse.model_validate(record)


@router.get(
    "",
    response_model=list[BodyMetricResponse],
)
def get_body_metrics(
    identity: CurrentIdentityDependency,
    db_session: DatabaseSessionDependency,
    metric_type: BodyMetricType | None = None,
) -> list[BodyMetricResponse]:
    records = list_body_metric_records(
        db_session=db_session,
        user_id=identity.user.id,
        metric_type=metric_type,
    )

    return [BodyMetricResponse.model_validate(record) for record in records]
