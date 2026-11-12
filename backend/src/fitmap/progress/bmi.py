from dataclasses import dataclass
from datetime import UTC, datetime
from decimal import ROUND_HALF_UP, Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from fitmap.identity.profiles import get_user_profile
from fitmap.progress.goal_progress import convert_measurement
from fitmap.progress.models import BodyMetricRecord
from fitmap.progress.schemas import BodyMetricType

_BMI_QUANTUM = Decimal("0.1")
_WEIGHT_QUANTUM = Decimal("0.01")
_CM_PER_METER = Decimal("100")


@dataclass(frozen=True, slots=True)
class BmiSnapshot:
    height_cm: Decimal | None
    weight_kg: Decimal | None
    bmi: Decimal | None
    weight_recorded_at: datetime | None


def calculate_bmi(
    *,
    weight_kg: Decimal,
    height_cm: Decimal,
) -> Decimal:
    if not weight_kg.is_finite() or not height_cm.is_finite() or weight_kg <= 0 or height_cm <= 0:
        raise ValueError("BMI requires positive finite measurements.")

    height_m = height_cm / _CM_PER_METER

    return (weight_kg / (height_m * height_m)).quantize(
        _BMI_QUANTUM,
        rounding=ROUND_HALF_UP,
    )


def get_bmi_snapshot(
    *,
    db_session: Session,
    user_id: UUID,
) -> BmiSnapshot:
    profile = get_user_profile(
        db_session=db_session,
        user_id=user_id,
    )

    height_cm = profile.height_cm if profile is not None else None

    latest_weight = db_session.scalar(
        select(BodyMetricRecord)
        .where(
            BodyMetricRecord.user_id == user_id,
            BodyMetricRecord.metric_type == BodyMetricType.WEIGHT.value,
            BodyMetricRecord.recorded_at <= datetime.now(UTC),
        )
        .order_by(
            BodyMetricRecord.recorded_at.desc(),
            BodyMetricRecord.id.desc(),
        )
        .limit(1)
    )

    if latest_weight is None:
        return BmiSnapshot(
            height_cm=height_cm,
            weight_kg=None,
            bmi=None,
            weight_recorded_at=None,
        )

    weight_kg = convert_measurement(
        value=latest_weight.value,
        from_unit=latest_weight.unit,
        to_unit="kg",
    )

    return BmiSnapshot(
        height_cm=height_cm,
        weight_kg=weight_kg.quantize(
            _WEIGHT_QUANTUM,
            rounding=ROUND_HALF_UP,
        ),
        bmi=(
            calculate_bmi(
                weight_kg=weight_kg,
                height_cm=height_cm,
            )
            if height_cm is not None
            else None
        ),
        weight_recorded_at=latest_weight.recorded_at,
    )
