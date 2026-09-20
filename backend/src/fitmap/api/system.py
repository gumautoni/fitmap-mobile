from typing import Literal

from fastapi import APIRouter, status
from pydantic import BaseModel
from sqlalchemy.exc import SQLAlchemyError

from fitmap.api.errors import ApiError, ErrorResponse
from fitmap.persistence.database import check_database_connection

router = APIRouter(tags=["system"])


class HealthResponse(BaseModel):
    status: Literal["ok"]


class ReadinessResponse(BaseModel):
    status: Literal["ready"]


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok")


@router.get(
    "/ready",
    response_model=ReadinessResponse,
    responses={503: {"model": ErrorResponse}},
)
def readiness() -> ReadinessResponse:
    try:
        check_database_connection()
    except SQLAlchemyError as exc:
        raise ApiError(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            code="database_unavailable",
            message="Database is unavailable.",
        ) from exc

    return ReadinessResponse(status="ready")
