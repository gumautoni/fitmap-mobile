from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from fitmap.gyms.review_models import GymReview, GymReviewReport
from fitmap.gyms.review_schemas import GymReviewReportReason


class GymReviewReportError(Exception):
    pass


class GymReviewReportNotFoundError(GymReviewReportError):
    pass


class GymReviewNotReportableError(GymReviewReportError):
    pass


class GymReviewSelfReportError(GymReviewReportError):
    pass


class GymReviewAlreadyReportedError(GymReviewReportError):
    pass


def create_gym_review_report(
    *,
    db_session: Session,
    reporter_user_id: UUID,
    review_id: UUID,
    reason: GymReviewReportReason,
    details: str | None,
) -> GymReviewReport:
    review = db_session.scalar(
        select(GymReview).where(
            GymReview.id == review_id,
            GymReview.removed_at.is_(None),
        )
    )

    if review is None:
        raise GymReviewReportNotFoundError("Review was not found.")

    if review.user_id == reporter_user_id:
        raise GymReviewSelfReportError("Users cannot report their own reviews.")

    if review.comment is None:
        raise GymReviewNotReportableError("Only written reviews can be reported.")

    existing_report = db_session.scalar(
        select(GymReviewReport.id).where(
            GymReviewReport.review_id == review_id,
            GymReviewReport.reporter_user_id == reporter_user_id,
        )
    )

    if existing_report is not None:
        raise GymReviewAlreadyReportedError("Review has already been reported by this user.")

    report = GymReviewReport(
        review_id=review_id,
        reporter_user_id=reporter_user_id,
        reason=reason.value,
        details=details,
    )

    db_session.add(report)
    db_session.flush()

    return report
