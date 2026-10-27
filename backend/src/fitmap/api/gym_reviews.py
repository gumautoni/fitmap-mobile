from uuid import UUID

from fastapi import APIRouter, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from fitmap.api.dependencies import (
    CurrentIdentityDependency,
    DatabaseSessionDependency,
)
from fitmap.api.errors import ApiError
from fitmap.gyms.review_models import GymReview
from fitmap.gyms.review_reports import (
    GymReviewAlreadyReportedError,
    GymReviewNotReportableError,
    GymReviewReportNotFoundError,
    GymReviewSelfReportError,
    create_gym_review_report,
)
from fitmap.gyms.review_schemas import (
    GymRatingSummaryResponse,
    GymReviewCreateRequest,
    GymReviewListResponse,
    GymReviewReportCreateRequest,
    GymReviewReportResponse,
    GymReviewResponse,
    GymReviewUpdateRequest,
)
from fitmap.gyms.reviews import (
    GymReviewAlreadyExistsError,
    GymReviewGymNotFoundError,
    GymReviewNotFoundError,
    create_gym_review,
    get_gym_rating_summary,
    list_gym_reviews,
    remove_gym_review,
    require_reviewable_gym,
    update_gym_review,
)

router = APIRouter(
    prefix="/gyms",
    tags=["gyms"],
)


def _gym_not_found() -> ApiError:
    return ApiError(
        status_code=404,
        code="gym_not_found",
        message="Gym was not found.",
    )


def _review_not_found() -> ApiError:
    return ApiError(
        status_code=404,
        code="gym_review_not_found",
        message="Review was not found.",
    )


def _constraint_name(exc: IntegrityError) -> str | None:
    diagnostic = getattr(exc.orig, "diag", None)
    name = getattr(diagnostic, "constraint_name", None)

    return name if isinstance(name, str) else None


@router.get(
    "/{gym_id}/reviews",
    response_model=GymReviewListResponse,
)
def get_reviews(
    gym_id: UUID,
    identity: CurrentIdentityDependency,
    db_session: DatabaseSessionDependency,
) -> GymReviewListResponse:
    try:
        reviews = list_gym_reviews(
            db_session=db_session,
            gym_id=gym_id,
        )
        summary = get_gym_rating_summary(
            db_session=db_session,
            gym_id=gym_id,
        )
    except GymReviewGymNotFoundError as exc:
        raise _gym_not_found() from exc

    return GymReviewListResponse(
        summary=GymRatingSummaryResponse(
            gym_id=summary.gym_id,
            average_rating=summary.average_rating,
            review_count=summary.review_count,
        ),
        reviews=[GymReviewResponse.model_validate(review) for review in reviews],
    )


@router.get(
    "/{gym_id}/reviews/mine",
    response_model=GymReviewResponse | None,
)
def get_my_review(
    gym_id: UUID,
    identity: CurrentIdentityDependency,
    db_session: DatabaseSessionDependency,
) -> GymReviewResponse | None:
    try:
        require_reviewable_gym(
            db_session=db_session,
            gym_id=gym_id,
        )
    except GymReviewGymNotFoundError as exc:
        raise _gym_not_found() from exc

    review = db_session.scalar(
        select(GymReview).where(
            GymReview.gym_id == gym_id,
            GymReview.user_id == identity.user.id,
            GymReview.removed_at.is_(None),
        )
    )

    if review is None:
        return None

    return GymReviewResponse.model_validate(review)


@router.post(
    "/{gym_id}/reviews",
    response_model=GymReviewResponse,
    status_code=status.HTTP_201_CREATED,
)
def post_review(
    gym_id: UUID,
    payload: GymReviewCreateRequest,
    identity: CurrentIdentityDependency,
    db_session: DatabaseSessionDependency,
) -> GymReviewResponse:
    try:
        with db_session.begin_nested():
            review = create_gym_review(
                db_session=db_session,
                user_id=identity.user.id,
                gym_id=gym_id,
                rating=payload.rating,
                comment=payload.comment,
            )
    except GymReviewGymNotFoundError as exc:
        raise _gym_not_found() from exc
    except GymReviewAlreadyExistsError as exc:
        raise ApiError(
            status_code=409,
            code="gym_review_already_exists",
            message="User already has an active review for this gym.",
        ) from exc
    except IntegrityError as exc:
        if _constraint_name(exc) != "uq_gym_reviews_active_user_gym":
            raise

        raise ApiError(
            status_code=409,
            code="gym_review_already_exists",
            message="User already has an active review for this gym.",
        ) from exc

    db_session.commit()
    db_session.refresh(review)

    return GymReviewResponse.model_validate(review)


@router.patch(
    "/reviews/{review_id}",
    response_model=GymReviewResponse,
)
def patch_review(
    review_id: UUID,
    payload: GymReviewUpdateRequest,
    identity: CurrentIdentityDependency,
    db_session: DatabaseSessionDependency,
) -> GymReviewResponse:
    try:
        review = update_gym_review(
            db_session=db_session,
            user_id=identity.user.id,
            review_id=review_id,
            rating=payload.rating,
            comment=payload.comment,
            update_comment=("comment" in payload.model_fields_set),
        )
    except GymReviewNotFoundError as exc:
        raise _review_not_found() from exc

    db_session.commit()
    db_session.refresh(review)

    return GymReviewResponse.model_validate(review)


@router.delete(
    "/reviews/{review_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_review(
    review_id: UUID,
    identity: CurrentIdentityDependency,
    db_session: DatabaseSessionDependency,
) -> Response:
    try:
        remove_gym_review(
            db_session=db_session,
            user_id=identity.user.id,
            review_id=review_id,
        )
    except GymReviewNotFoundError as exc:
        raise _review_not_found() from exc

    db_session.commit()

    return Response(status_code=204)


@router.post(
    "/reviews/{review_id}/reports",
    response_model=GymReviewReportResponse,
    status_code=status.HTTP_201_CREATED,
)
def post_review_report(
    review_id: UUID,
    payload: GymReviewReportCreateRequest,
    identity: CurrentIdentityDependency,
    db_session: DatabaseSessionDependency,
) -> GymReviewReportResponse:
    try:
        with db_session.begin_nested():
            report = create_gym_review_report(
                db_session=db_session,
                reporter_user_id=identity.user.id,
                review_id=review_id,
                reason=payload.reason,
                details=payload.details,
            )
    except GymReviewReportNotFoundError as exc:
        raise _review_not_found() from exc
    except GymReviewSelfReportError as exc:
        raise ApiError(
            status_code=403,
            code="gym_review_self_report_forbidden",
            message="Users cannot report their own reviews.",
        ) from exc
    except GymReviewNotReportableError as exc:
        raise ApiError(
            status_code=422,
            code="gym_review_not_reportable",
            message="Only written reviews can be reported.",
        ) from exc
    except GymReviewAlreadyReportedError as exc:
        raise ApiError(
            status_code=409,
            code="gym_review_already_reported",
            message="Review has already been reported by this user.",
        ) from exc
    except IntegrityError as exc:
        if _constraint_name(exc) != "uq_gym_review_reports_review_reporter":
            raise

        raise ApiError(
            status_code=409,
            code="gym_review_already_reported",
            message="Review has already been reported by this user.",
        ) from exc

    db_session.commit()
    db_session.refresh(report)

    return GymReviewReportResponse.model_validate(report)
