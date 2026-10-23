from datetime import datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from fitmap.progress.models import BodyMetricRecord
from fitmap.progress.schemas import BodyMetricType, BodyMetricUnit


def create_body_metric_record(
    *,
    db_session: Session,
    user_id: UUID,
    metric_type: BodyMetricType,
    value: Decimal,
    unit: BodyMetricUnit,
    recorded_at: datetime,
) -> BodyMetricRecord:
    record = BodyMetricRecord(
        user_id=user_id,
        metric_type=metric_type.value,
        value=value,
        unit=unit.value,
        recorded_at=recorded_at,
    )

    db_session.add(record)
    db_session.flush()

    return record


def list_body_metric_records(
    *,
    db_session: Session,
    user_id: UUID,
    metric_type: BodyMetricType | None = None,
) -> list[BodyMetricRecord]:
    statement = select(BodyMetricRecord).where(
        BodyMetricRecord.user_id == user_id,
    )

    if metric_type is not None:
        statement = statement.where(
            BodyMetricRecord.metric_type == metric_type.value,
        )

    statement = statement.order_by(
        BodyMetricRecord.recorded_at.desc(),
        BodyMetricRecord.id.desc(),
    )

    return list(db_session.scalars(statement).all())
