from collections.abc import Iterator
from uuid import uuid4

import pytest
from sqlalchemy import Engine, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from fitmap.gyms.models import Gym
from fitmap.gyms.review_models import GymReview, GymReviewReport
from fitmap.gyms.review_reports import (
    GymReviewAlreadyReportedError,
    GymReviewNotReportableError,
    GymReviewReportNotFoundError,
    GymReviewSelfReportError,
    create_gym_review_report,
)
from fitmap.gyms.review_schemas import GymReviewReportReason
from fitmap.gyms.reviews import (
    create_gym_review,
    remove_gym_review,
)
from fitmap.identity.models import User


@pytest.fixture
def db_session(
    database_engine: Engine,
) -> Iterator[Session]:
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


def create_user(db_session: Session) -> User:
    user = User(
        name="Gym Review Report Test User",
        email=f"gym-report-{uuid4()}@example.com",
        password_hash="test-password-hash",
    )

    db_session.add(user)
    db_session.flush()

    return user


def create_gym(db_session: Session) -> Gym:
    gym = Gym(
        name="Gym Review Report Test",
        address="Rua de Teste, 100",
    )

    db_session.add(gym)
    db_session.flush()

    return gym


def create_written_review(
    db_session: Session,
    *,
    author: User,
    gym: Gym,
) -> GymReview:
    return create_gym_review(
        db_session=db_session,
        user_id=author.id,
        gym_id=gym.id,
        rating=4,
        comment="Comentario utilizado nos testes.",
    )


def test_create_report_persists_correct_data(
    db_session: Session,
) -> None:
    author = create_user(db_session)
    reporter = create_user(db_session)
    gym = create_gym(db_session)

    review = create_written_review(
        db_session,
        author=author,
        gym=gym,
    )

    report = create_gym_review_report(
        db_session=db_session,
        reporter_user_id=reporter.id,
        review_id=review.id,
        reason=GymReviewReportReason.MISLEADING,
        details="Informacao incorreta.",
    )

    persisted = db_session.get(
        GymReviewReport,
        report.id,
    )

    assert persisted is not None
    assert persisted.review_id == review.id
    assert persisted.reporter_user_id == reporter.id
    assert persisted.reason == "misleading"
    assert persisted.details == "Informacao incorreta."
    assert persisted.created_at is not None


def test_create_report_allows_optional_details(
    db_session: Session,
) -> None:
    author = create_user(db_session)
    reporter = create_user(db_session)
    gym = create_gym(db_session)

    review = create_written_review(
        db_session,
        author=author,
        gym=gym,
    )

    report = create_gym_review_report(
        db_session=db_session,
        reporter_user_id=reporter.id,
        review_id=review.id,
        reason=GymReviewReportReason.SPAM,
        details=None,
    )

    assert report.reason == "spam"
    assert report.details is None


def test_cannot_report_nonexistent_review(
    db_session: Session,
) -> None:
    reporter = create_user(db_session)

    with pytest.raises(GymReviewReportNotFoundError):
        create_gym_review_report(
            db_session=db_session,
            reporter_user_id=reporter.id,
            review_id=uuid4(),
            reason=GymReviewReportReason.SPAM,
            details=None,
        )


def test_cannot_report_removed_review(
    db_session: Session,
) -> None:
    author = create_user(db_session)
    reporter = create_user(db_session)
    gym = create_gym(db_session)

    review = create_written_review(
        db_session,
        author=author,
        gym=gym,
    )

    remove_gym_review(
        db_session=db_session,
        user_id=author.id,
        review_id=review.id,
    )

    with pytest.raises(GymReviewReportNotFoundError):
        create_gym_review_report(
            db_session=db_session,
            reporter_user_id=reporter.id,
            review_id=review.id,
            reason=GymReviewReportReason.SPAM,
            details=None,
        )


def test_cannot_report_own_review(
    db_session: Session,
) -> None:
    author = create_user(db_session)
    gym = create_gym(db_session)

    review = create_written_review(
        db_session,
        author=author,
        gym=gym,
    )

    with pytest.raises(GymReviewSelfReportError):
        create_gym_review_report(
            db_session=db_session,
            reporter_user_id=author.id,
            review_id=review.id,
            reason=GymReviewReportReason.OFFENSIVE,
            details=None,
        )


def test_cannot_report_rating_without_comment(
    db_session: Session,
) -> None:
    author = create_user(db_session)
    reporter = create_user(db_session)
    gym = create_gym(db_session)

    review = create_gym_review(
        db_session=db_session,
        user_id=author.id,
        gym_id=gym.id,
        rating=3,
        comment=None,
    )

    with pytest.raises(GymReviewNotReportableError):
        create_gym_review_report(
            db_session=db_session,
            reporter_user_id=reporter.id,
            review_id=review.id,
            reason=GymReviewReportReason.OTHER,
            details=None,
        )


def test_same_user_cannot_report_review_twice(
    db_session: Session,
) -> None:
    author = create_user(db_session)
    reporter = create_user(db_session)
    gym = create_gym(db_session)

    review = create_written_review(
        db_session,
        author=author,
        gym=gym,
    )

    create_gym_review_report(
        db_session=db_session,
        reporter_user_id=reporter.id,
        review_id=review.id,
        reason=GymReviewReportReason.SPAM,
        details=None,
    )

    with pytest.raises(GymReviewAlreadyReportedError):
        create_gym_review_report(
            db_session=db_session,
            reporter_user_id=reporter.id,
            review_id=review.id,
            reason=GymReviewReportReason.OFFENSIVE,
            details="Segundo motivo.",
        )

    reports = db_session.scalars(
        select(GymReviewReport).where(
            GymReviewReport.review_id == review.id,
        )
    ).all()

    assert len(reports) == 1


def test_different_users_can_report_same_review(
    db_session: Session,
) -> None:
    author = create_user(db_session)
    first_reporter = create_user(db_session)
    second_reporter = create_user(db_session)
    gym = create_gym(db_session)

    review = create_written_review(
        db_session,
        author=author,
        gym=gym,
    )

    first = create_gym_review_report(
        db_session=db_session,
        reporter_user_id=first_reporter.id,
        review_id=review.id,
        reason=GymReviewReportReason.SPAM,
        details=None,
    )

    second = create_gym_review_report(
        db_session=db_session,
        reporter_user_id=second_reporter.id,
        review_id=review.id,
        reason=GymReviewReportReason.OFFENSIVE,
        details=None,
    )

    assert first.id != second.id
    assert first.reporter_user_id != second.reporter_user_id


def test_same_user_can_report_different_reviews(
    db_session: Session,
) -> None:
    first_author = create_user(db_session)
    second_author = create_user(db_session)
    reporter = create_user(db_session)
    gym = create_gym(db_session)

    first_review = create_written_review(
        db_session,
        author=first_author,
        gym=gym,
    )

    second_review = create_written_review(
        db_session,
        author=second_author,
        gym=gym,
    )

    first = create_gym_review_report(
        db_session=db_session,
        reporter_user_id=reporter.id,
        review_id=first_review.id,
        reason=GymReviewReportReason.SPAM,
        details=None,
    )

    second = create_gym_review_report(
        db_session=db_session,
        reporter_user_id=reporter.id,
        review_id=second_review.id,
        reason=GymReviewReportReason.MISLEADING,
        details=None,
    )

    assert first.review_id != second.review_id


def test_database_rejects_duplicate_report(
    db_session: Session,
) -> None:
    author = create_user(db_session)
    reporter = create_user(db_session)
    gym = create_gym(db_session)

    review = create_written_review(
        db_session,
        author=author,
        gym=gym,
    )

    create_gym_review_report(
        db_session=db_session,
        reporter_user_id=reporter.id,
        review_id=review.id,
        reason=GymReviewReportReason.SPAM,
        details=None,
    )

    with pytest.raises(IntegrityError), db_session.begin_nested():
        duplicate = GymReviewReport(
            review_id=review.id,
            reporter_user_id=reporter.id,
            reason="offensive",
            details=None,
        )

        db_session.add(duplicate)
        db_session.flush()

    reports = db_session.scalars(
        select(GymReviewReport).where(
            GymReviewReport.review_id == review.id,
        )
    ).all()

    assert len(reports) == 1


@pytest.mark.parametrize(
    "reason",
    ["unknown", ""],
)
def test_database_rejects_invalid_reason(
    db_session: Session,
    reason: str,
) -> None:
    author = create_user(db_session)
    reporter = create_user(db_session)
    gym = create_gym(db_session)

    review = create_written_review(
        db_session,
        author=author,
        gym=gym,
    )

    with pytest.raises(IntegrityError), db_session.begin_nested():
        invalid = GymReviewReport(
            review_id=review.id,
            reporter_user_id=reporter.id,
            reason=reason,
            details=None,
        )

        db_session.add(invalid)
        db_session.flush()


def test_database_rejects_blank_report_details(
    db_session: Session,
) -> None:
    author = create_user(db_session)
    reporter = create_user(db_session)
    gym = create_gym(db_session)

    review = create_written_review(
        db_session,
        author=author,
        gym=gym,
    )

    with pytest.raises(IntegrityError), db_session.begin_nested():
        invalid = GymReviewReport(
            review_id=review.id,
            reporter_user_id=reporter.id,
            reason="spam",
            details="   ",
        )

        db_session.add(invalid)
        db_session.flush()


def test_removing_review_preserves_existing_report(
    db_session: Session,
) -> None:
    author = create_user(db_session)
    reporter = create_user(db_session)
    gym = create_gym(db_session)

    review = create_written_review(
        db_session,
        author=author,
        gym=gym,
    )

    report = create_gym_review_report(
        db_session=db_session,
        reporter_user_id=reporter.id,
        review_id=review.id,
        reason=GymReviewReportReason.SPAM,
        details=None,
    )

    remove_gym_review(
        db_session=db_session,
        user_id=author.id,
        review_id=review.id,
    )

    persisted = db_session.get(
        GymReviewReport,
        report.id,
    )

    assert review.removed_at is not None
    assert persisted is not None
    assert persisted.review_id == review.id
