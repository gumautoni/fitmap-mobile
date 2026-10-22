from collections.abc import Iterator
from datetime import UTC, datetime
from decimal import Decimal
from uuid import UUID, uuid4

import pytest
from sqlalchemy import Engine, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from fitmap.identity.models import User
from fitmap.progress.body_metrics import (
    create_body_metric_record,
    list_body_metric_records,
)
from fitmap.progress.models import BodyMetricRecord
from fitmap.progress.schemas import BodyMetricType, BodyMetricUnit


@pytest.fixture
def db_session(database_engine: Engine) -> Iterator[Session]:
    connection = database_engine.connect()
    transaction = connection.begin()

    session = Session(
        bind=connection,
        expire_on_commit=False,
    )

    try:
        yield session
    finally:
        session.close()

        if transaction.is_active:
            transaction.rollback()

        connection.close()


def create_user(
    db_session: Session,
) -> User:
    user = User(
        name="Body Metrics Test User",
        email=f"body-metrics-{uuid4()}@example.com",
        password_hash="test-password-hash",
    )

    db_session.add(user)
    db_session.flush()

    return user


def create_weight_record(
    *,
    db_session: Session,
    user_id: UUID,
    value: Decimal = Decimal("78.50"),
    recorded_at: datetime | None = None,
) -> BodyMetricRecord:
    return create_body_metric_record(
        db_session=db_session,
        user_id=user_id,
        metric_type=BodyMetricType.WEIGHT,
        value=value,
        unit=BodyMetricUnit.KG,
        recorded_at=recorded_at or datetime(2026, 10, 21, 12, 0, tzinfo=UTC),
    )


def test_create_body_metric_record_persists_data(
    db_session: Session,
) -> None:
    user = create_user(db_session)

    record = create_weight_record(
        db_session=db_session,
        user_id=user.id,
    )

    persisted_record = db_session.get(
        BodyMetricRecord,
        record.id,
    )

    assert persisted_record is not None
    assert persisted_record.user_id == user.id
    assert persisted_record.metric_type == "weight"
    assert persisted_record.value == Decimal("78.50")
    assert persisted_record.unit == "kg"
    assert persisted_record.recorded_at.year == 2026


def test_body_metric_history_is_sorted_newest_first(
    db_session: Session,
) -> None:
    user = create_user(db_session)

    oldest = create_weight_record(
        db_session=db_session,
        user_id=user.id,
        value=Decimal("80.00"),
        recorded_at=datetime(2026, 10, 1, tzinfo=UTC),
    )

    newest = create_weight_record(
        db_session=db_session,
        user_id=user.id,
        value=Decimal("78.50"),
        recorded_at=datetime(2026, 10, 21, tzinfo=UTC),
    )

    middle = create_weight_record(
        db_session=db_session,
        user_id=user.id,
        value=Decimal("79.20"),
        recorded_at=datetime(2026, 10, 10, tzinfo=UTC),
    )

    history = list_body_metric_records(
        db_session=db_session,
        user_id=user.id,
    )

    assert [record.id for record in history] == [
        newest.id,
        middle.id,
        oldest.id,
    ]


def test_body_metric_history_can_be_filtered_by_type(
    db_session: Session,
) -> None:
    user = create_user(db_session)

    weight = create_weight_record(
        db_session=db_session,
        user_id=user.id,
    )

    waist = create_body_metric_record(
        db_session=db_session,
        user_id=user.id,
        metric_type=BodyMetricType.WAIST,
        value=Decimal("85.30"),
        unit=BodyMetricUnit.CM,
        recorded_at=datetime(2026, 10, 21, tzinfo=UTC),
    )

    weight_history = list_body_metric_records(
        db_session=db_session,
        user_id=user.id,
        metric_type=BodyMetricType.WEIGHT,
    )

    waist_history = list_body_metric_records(
        db_session=db_session,
        user_id=user.id,
        metric_type=BodyMetricType.WAIST,
    )

    all_history = list_body_metric_records(
        db_session=db_session,
        user_id=user.id,
    )

    assert [record.id for record in weight_history] == [weight.id]

    assert [record.id for record in waist_history] == [waist.id]

    assert len(all_history) == 2


def test_body_metrics_are_isolated_between_users(
    db_session: Session,
) -> None:
    first_user = create_user(db_session)
    second_user = create_user(db_session)

    first_record = create_weight_record(
        db_session=db_session,
        user_id=first_user.id,
        value=Decimal("70.00"),
    )

    second_record = create_weight_record(
        db_session=db_session,
        user_id=second_user.id,
        value=Decimal("90.00"),
    )

    first_history = list_body_metric_records(
        db_session=db_session,
        user_id=first_user.id,
    )

    second_history = list_body_metric_records(
        db_session=db_session,
        user_id=second_user.id,
    )

    assert [record.id for record in first_history] == [first_record.id]

    assert [record.id for record in second_history] == [second_record.id]


def test_user_can_record_multiple_measurements_on_same_day(
    db_session: Session,
) -> None:
    user = create_user(db_session)

    create_weight_record(
        db_session=db_session,
        user_id=user.id,
        value=Decimal("78.50"),
    )

    create_weight_record(
        db_session=db_session,
        user_id=user.id,
        value=Decimal("78.20"),
    )

    history = list_body_metric_records(
        db_session=db_session,
        user_id=user.id,
    )

    assert len(history) == 2

    assert {record.value for record in history} == {
        Decimal("78.50"),
        Decimal("78.20"),
    }


@pytest.mark.parametrize(
    ("metric_type", "unit", "value"),
    [
        ("weight", "cm", Decimal("78.50")),
        ("waist", "kg", Decimal("85.00")),
        ("weight", "kg", Decimal("0.00")),
        ("unsupported", "cm", Decimal("50.00")),
    ],
)
def test_database_rejects_invalid_body_metrics(
    db_session: Session,
    metric_type: str,
    unit: str,
    value: Decimal,
) -> None:
    user = create_user(db_session)

    with pytest.raises(IntegrityError), db_session.begin_nested():
        record = BodyMetricRecord(
            user_id=user.id,
            metric_type=metric_type,
            value=value,
            unit=unit,
            recorded_at=datetime(2026, 10, 21, tzinfo=UTC),
        )

        db_session.add(record)
        db_session.flush()

    remaining_records = db_session.scalars(
        select(BodyMetricRecord).where(
            BodyMetricRecord.user_id == user.id,
        )
    ).all()

    assert remaining_records == []


def test_deleting_user_cascades_to_body_metrics(
    db_session: Session,
) -> None:
    user = create_user(db_session)

    record = create_weight_record(
        db_session=db_session,
        user_id=user.id,
    )

    record_id = record.id

    db_session.delete(user)
    db_session.flush()

    remaining_record = db_session.scalar(
        select(BodyMetricRecord).where(
            BodyMetricRecord.id == record_id,
        )
    )

    assert remaining_record is None
