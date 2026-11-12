from datetime import datetime
from decimal import Decimal

from fastapi import APIRouter, Response
from pydantic import BaseModel

from fitmap.api.dependencies import (
    CurrentIdentityDependency,
    DatabaseSessionDependency,
)
from fitmap.progress.bmi import get_bmi_snapshot

router = APIRouter(
    prefix="/progress",
    tags=["progress"],
)


class BmiResponse(BaseModel):
    height_cm: Decimal | None
    weight_kg: Decimal | None
    bmi: Decimal | None
    weight_recorded_at: datetime | None


@router.get("/bmi", response_model=BmiResponse)
def get_body_mass_index(
    identity: CurrentIdentityDependency,
    db_session: DatabaseSessionDependency,
    response: Response,
) -> BmiResponse:
    snapshot = get_bmi_snapshot(
        db_session=db_session,
        user_id=identity.user.id,
    )

    response.headers["Cache-Control"] = "private, no-store"

    return BmiResponse(
        height_cm=snapshot.height_cm,
        weight_kg=snapshot.weight_kg,
        bmi=snapshot.bmi,
        weight_recorded_at=snapshot.weight_recorded_at,
    )
