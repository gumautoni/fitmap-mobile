from dataclasses import dataclass
from datetime import UTC, datetime
from decimal import ROUND_HALF_UP, Decimal
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from fitmap.gyms.models import Gym
from fitmap.gyms.review_models import GymReview


class GymReviewError(Exception):
    pass


class GymReviewGymNotFoundError(GymReviewError):
    pass


class GymReviewNotFoundError(GymReviewError):
    pass


class GymReviewAlreadyExistsError(GymReviewError):
    pass


@dataclass(frozen=True, slots=True)
class GymRatingSummary:
    gym_id: UUID
    average_rating: Decimal | None
    review_count: int


def require_reviewable_gym(
    *,
    db_session: Session,
    gym_id: UUID,
) -> Gym:
    gym = db_session.get(Gym, gym_id)

    if gym is None:
        raise GymReviewGymNotFoundError("Gym was not found.")

    return gym


def get_owned_active_review(
    *,
    db_session: Session,
    user_id: UUID,
    review_id: UUID,
) -> GymReview | None:
    statement = select(GymReview).where(
        GymReview.id == review_id,
        GymReview.user_id == user_id,
        GymReview.removed_at.is_(None),
    )

    return db_session.scalar(statement)


def create_gym_review(
    *,
    db_session: Session,
    user_id: UUID,
    gym_id: UUID,
    rating: int,
    comment: str | None,
) -> GymReview:
    require_reviewable_gym(
        db_session=db_session,
        gym_id=gym_id,
    )

    existing = db_session.scalar(
        select(GymReview).where(
            GymReview.user_id == user_id,
            GymReview.gym_id == gym_id,
            GymReview.removed_at.is_(None),
        )
    )

    if existing is not None:
        raise GymReviewAlreadyExistsError("User already has an active review for this gym.")

    review = GymReview(
        user_id=user_id,
        gym_id=gym_id,
        rating=rating,
        comment=comment,
    )

    db_session.add(review)
    db_session.flush()

    return review


def list_gym_reviews(
    *,
    db_session: Session,
    gym_id: UUID,
) -> list[GymReview]:
    require_reviewable_gym(
        db_session=db_session,
        gym_id=gym_id,
    )

    statement = (
        select(GymReview)
        .where(
            GymReview.gym_id == gym_id,
            GymReview.removed_at.is_(None),
        )
        .order_by(
            GymReview.created_at.desc(),
            GymReview.id.desc(),
        )
    )

    return list(db_session.scalars(statement).all())


def get_gym_rating_summary(
    *,
    db_session: Session,
    gym_id: UUID,
) -> GymRatingSummary:
    require_reviewable_gym(
        db_session=db_session,
        gym_id=gym_id,
    )

    statement = select(
        func.count(GymReview.id),
        func.avg(GymReview.rating),
    ).where(
        GymReview.gym_id == gym_id,
        GymReview.removed_at.is_(None),
    )

    result = db_session.execute(statement).one()

    review_count = int(result[0])
    average = result[1]

    average_rating = (
        Decimal(str(average)).quantize(
            Decimal("0.01"),
            rounding=ROUND_HALF_UP,
        )
        if average is not None
        else None
    )

    return GymRatingSummary(
        gym_id=gym_id,
        average_rating=average_rating,
        review_count=review_count,
    )


def update_gym_review(
    *,
    db_session: Session,
    user_id: UUID,
    review_id: UUID,
    rating: int | None = None,
    comment: str | None = None,
    update_comment: bool = False,
) -> GymReview:
    if rating is None and not update_comment:
        raise ValueError("At least one review field must be provided.")

    review = get_owned_active_review(
        db_session=db_session,
        user_id=user_id,
        review_id=review_id,
    )

    if review is None:
        raise GymReviewNotFoundError("Review was not found.")

    if rating is not None:
        review.rating = rating

    if update_comment:
        review.comment = comment

    db_session.flush()

    return review


def remove_gym_review(
    *,
    db_session: Session,
    user_id: UUID,
    review_id: UUID,
) -> None:
    review = get_owned_active_review(
        db_session=db_session,
        user_id=user_id,
        review_id=review_id,
    )

    if review is None:
        raise GymReviewNotFoundError("Review was not found.")

    review.removed_at = datetime.now(UTC)

    db_session.flush()
