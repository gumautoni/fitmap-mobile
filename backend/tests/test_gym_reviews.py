from collections.abc import Iterator
from datetime import UTC, datetime
from decimal import Decimal
from uuid import uuid4

import pytest
from sqlalchemy import Engine, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from fitmap.gyms.models import Gym
from fitmap.gyms.review_models import GymReview
from fitmap.gyms.reviews import (
    GymReviewAlreadyExistsError,
    GymReviewGymNotFoundError,
    GymReviewNotFoundError,
    create_gym_review,
    get_gym_rating_summary,
    get_owned_active_review,
    list_gym_reviews,
    remove_gym_review,
    update_gym_review,
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


def create_user(
    db_session: Session,
) -> User:
    user = User(
        name="Gym Review Test User",
        email=f"gym-review-{uuid4()}@example.com",
        password_hash="test-password-hash",
    )

    db_session.add(user)
    db_session.flush()

    return user


def create_gym(
    db_session: Session,
) -> Gym:
    gym = Gym(
        name="Gym Review Test",
        address="Rua de Teste, 100",
    )

    db_session.add(gym)
    db_session.flush()

    return gym


def test_create_review_persists_user_gym_and_rating(
    db_session: Session,
) -> None:
    user = create_user(db_session)
    gym = create_gym(db_session)

    review = create_gym_review(
        db_session=db_session,
        user_id=user.id,
        gym_id=gym.id,
        rating=5,
        comment="Excelente academia.",
    )

    persisted = db_session.get(GymReview, review.id)

    assert persisted is not None
    assert persisted.user_id == user.id
    assert persisted.gym_id == gym.id
    assert persisted.rating == 5
    assert persisted.comment == "Excelente academia."
    assert persisted.removed_at is None
    assert persisted.created_at is not None
    assert persisted.updated_at is not None


def test_create_review_accepts_no_comment(
    db_session: Session,
) -> None:
    user = create_user(db_session)
    gym = create_gym(db_session)

    review = create_gym_review(
        db_session=db_session,
        user_id=user.id,
        gym_id=gym.id,
        rating=4,
        comment=None,
    )

    assert review.comment is None


def test_cannot_review_nonexistent_gym(
    db_session: Session,
) -> None:
    user = create_user(db_session)

    with pytest.raises(GymReviewGymNotFoundError):
        create_gym_review(
            db_session=db_session,
            user_id=user.id,
            gym_id=uuid4(),
            rating=5,
            comment=None,
        )


def test_same_user_cannot_create_two_active_reviews(
    db_session: Session,
) -> None:
    user = create_user(db_session)
    gym = create_gym(db_session)

    create_gym_review(
        db_session=db_session,
        user_id=user.id,
        gym_id=gym.id,
        rating=5,
        comment=None,
    )

    with pytest.raises(GymReviewAlreadyExistsError):
        create_gym_review(
            db_session=db_session,
            user_id=user.id,
            gym_id=gym.id,
            rating=3,
            comment=None,
        )

    reviews = list_gym_reviews(
        db_session=db_session,
        gym_id=gym.id,
    )

    assert len(reviews) == 1
    assert reviews[0].rating == 5


def test_different_users_can_review_same_gym(
    db_session: Session,
) -> None:
    first_user = create_user(db_session)
    second_user = create_user(db_session)
    gym = create_gym(db_session)

    first = create_gym_review(
        db_session=db_session,
        user_id=first_user.id,
        gym_id=gym.id,
        rating=5,
        comment=None,
    )

    second = create_gym_review(
        db_session=db_session,
        user_id=second_user.id,
        gym_id=gym.id,
        rating=3,
        comment=None,
    )

    assert first.id != second.id
    assert (
        len(
            list_gym_reviews(
                db_session=db_session,
                gym_id=gym.id,
            )
        )
        == 2
    )


def test_same_user_can_review_different_gyms(
    db_session: Session,
) -> None:
    user = create_user(db_session)
    first_gym = create_gym(db_session)
    second_gym = create_gym(db_session)

    first = create_gym_review(
        db_session=db_session,
        user_id=user.id,
        gym_id=first_gym.id,
        rating=5,
        comment=None,
    )

    second = create_gym_review(
        db_session=db_session,
        user_id=user.id,
        gym_id=second_gym.id,
        rating=2,
        comment=None,
    )

    assert first.gym_id != second.gym_id


def test_database_prevents_duplicate_active_reviews(
    db_session: Session,
) -> None:
    user = create_user(db_session)
    gym = create_gym(db_session)

    create_gym_review(
        db_session=db_session,
        user_id=user.id,
        gym_id=gym.id,
        rating=5,
        comment=None,
    )

    with pytest.raises(IntegrityError), db_session.begin_nested():
        duplicate = GymReview(
            user_id=user.id,
            gym_id=gym.id,
            rating=3,
            comment=None,
        )

        db_session.add(duplicate)
        db_session.flush()

    reviews = list_gym_reviews(
        db_session=db_session,
        gym_id=gym.id,
    )

    assert len(reviews) == 1


@pytest.mark.parametrize("rating", [0, 6])
def test_database_rejects_ratings_outside_range(
    db_session: Session,
    rating: int,
) -> None:
    user = create_user(db_session)
    gym = create_gym(db_session)

    with pytest.raises(IntegrityError), db_session.begin_nested():
        invalid = GymReview(
            user_id=user.id,
            gym_id=gym.id,
            rating=rating,
            comment=None,
        )

        db_session.add(invalid)
        db_session.flush()


def test_reviews_are_sorted_newest_first(
    db_session: Session,
) -> None:
    first_user = create_user(db_session)
    second_user = create_user(db_session)
    gym = create_gym(db_session)

    first = create_gym_review(
        db_session=db_session,
        user_id=first_user.id,
        gym_id=gym.id,
        rating=2,
        comment=None,
    )

    second = create_gym_review(
        db_session=db_session,
        user_id=second_user.id,
        gym_id=gym.id,
        rating=5,
        comment=None,
    )

    first.created_at = datetime(2026, 10, 1, tzinfo=UTC)
    second.created_at = datetime(2026, 10, 23, tzinfo=UTC)

    db_session.flush()

    reviews = list_gym_reviews(
        db_session=db_session,
        gym_id=gym.id,
    )

    assert [review.id for review in reviews] == [
        second.id,
        first.id,
    ]


def test_reviews_are_isolated_by_gym(
    db_session: Session,
) -> None:
    user = create_user(db_session)
    first_gym = create_gym(db_session)
    second_gym = create_gym(db_session)

    first_review = create_gym_review(
        db_session=db_session,
        user_id=user.id,
        gym_id=first_gym.id,
        rating=5,
        comment=None,
    )

    create_gym_review(
        db_session=db_session,
        user_id=user.id,
        gym_id=second_gym.id,
        rating=1,
        comment=None,
    )

    reviews = list_gym_reviews(
        db_session=db_session,
        gym_id=first_gym.id,
    )

    assert [review.id for review in reviews] == [first_review.id]


def test_gym_without_reviews_has_empty_summary(
    db_session: Session,
) -> None:
    gym = create_gym(db_session)

    summary = get_gym_rating_summary(
        db_session=db_session,
        gym_id=gym.id,
    )

    assert summary.gym_id == gym.id
    assert summary.review_count == 0
    assert summary.average_rating is None


def test_average_rating_is_calculated_correctly(
    db_session: Session,
) -> None:
    first_user = create_user(db_session)
    second_user = create_user(db_session)
    gym = create_gym(db_session)

    create_gym_review(
        db_session=db_session,
        user_id=first_user.id,
        gym_id=gym.id,
        rating=5,
        comment=None,
    )

    create_gym_review(
        db_session=db_session,
        user_id=second_user.id,
        gym_id=gym.id,
        rating=4,
        comment=None,
    )

    summary = get_gym_rating_summary(
        db_session=db_session,
        gym_id=gym.id,
    )

    assert summary.review_count == 2
    assert summary.average_rating == Decimal("4.50")


def test_summary_is_isolated_by_gym(
    db_session: Session,
) -> None:
    user = create_user(db_session)
    first_gym = create_gym(db_session)
    second_gym = create_gym(db_session)

    create_gym_review(
        db_session=db_session,
        user_id=user.id,
        gym_id=first_gym.id,
        rating=5,
        comment=None,
    )

    first_summary = get_gym_rating_summary(
        db_session=db_session,
        gym_id=first_gym.id,
    )

    second_summary = get_gym_rating_summary(
        db_session=db_session,
        gym_id=second_gym.id,
    )

    assert first_summary.average_rating == Decimal("5.00")
    assert second_summary.average_rating is None
    assert second_summary.review_count == 0


def test_update_rating_changes_review_and_average(
    db_session: Session,
) -> None:
    user = create_user(db_session)
    gym = create_gym(db_session)

    review = create_gym_review(
        db_session=db_session,
        user_id=user.id,
        gym_id=gym.id,
        rating=5,
        comment="Original",
    )

    updated = update_gym_review(
        db_session=db_session,
        user_id=user.id,
        review_id=review.id,
        rating=3,
    )

    summary = get_gym_rating_summary(
        db_session=db_session,
        gym_id=gym.id,
    )

    assert updated.rating == 3
    assert updated.comment == "Original"
    assert summary.average_rating == Decimal("3.00")


def test_update_comment_preserves_rating(
    db_session: Session,
) -> None:
    user = create_user(db_session)
    gym = create_gym(db_session)

    review = create_gym_review(
        db_session=db_session,
        user_id=user.id,
        gym_id=gym.id,
        rating=5,
        comment="Anterior",
    )

    updated = update_gym_review(
        db_session=db_session,
        user_id=user.id,
        review_id=review.id,
        comment="Atualizado",
        update_comment=True,
    )

    assert updated.rating == 5
    assert updated.comment == "Atualizado"


def test_update_can_remove_optional_comment(
    db_session: Session,
) -> None:
    user = create_user(db_session)
    gym = create_gym(db_session)

    review = create_gym_review(
        db_session=db_session,
        user_id=user.id,
        gym_id=gym.id,
        rating=4,
        comment="Texto anterior",
    )

    updated = update_gym_review(
        db_session=db_session,
        user_id=user.id,
        review_id=review.id,
        comment=None,
        update_comment=True,
    )

    assert updated.rating == 4
    assert updated.comment is None


def test_update_rejects_empty_changes(
    db_session: Session,
) -> None:
    user = create_user(db_session)
    gym = create_gym(db_session)

    review = create_gym_review(
        db_session=db_session,
        user_id=user.id,
        gym_id=gym.id,
        rating=4,
        comment=None,
    )

    with pytest.raises(ValueError):
        update_gym_review(
            db_session=db_session,
            user_id=user.id,
            review_id=review.id,
        )


def test_user_cannot_update_another_users_review(
    db_session: Session,
) -> None:
    owner = create_user(db_session)
    other_user = create_user(db_session)
    gym = create_gym(db_session)

    review = create_gym_review(
        db_session=db_session,
        user_id=owner.id,
        gym_id=gym.id,
        rating=5,
        comment="Original",
    )

    with pytest.raises(GymReviewNotFoundError):
        update_gym_review(
            db_session=db_session,
            user_id=other_user.id,
            review_id=review.id,
            rating=1,
        )

    assert review.rating == 5
    assert review.comment == "Original"


def test_user_cannot_remove_another_users_review(
    db_session: Session,
) -> None:
    owner = create_user(db_session)
    other_user = create_user(db_session)
    gym = create_gym(db_session)

    review = create_gym_review(
        db_session=db_session,
        user_id=owner.id,
        gym_id=gym.id,
        rating=5,
        comment=None,
    )

    with pytest.raises(GymReviewNotFoundError):
        remove_gym_review(
            db_session=db_session,
            user_id=other_user.id,
            review_id=review.id,
        )

    assert review.removed_at is None


def test_owned_review_lookup_is_restricted_to_author(
    db_session: Session,
) -> None:
    owner = create_user(db_session)
    other_user = create_user(db_session)
    gym = create_gym(db_session)

    review = create_gym_review(
        db_session=db_session,
        user_id=owner.id,
        gym_id=gym.id,
        rating=5,
        comment=None,
    )

    own_review = get_owned_active_review(
        db_session=db_session,
        user_id=owner.id,
        review_id=review.id,
    )

    other_review = get_owned_active_review(
        db_session=db_session,
        user_id=other_user.id,
        review_id=review.id,
    )

    assert own_review is not None
    assert own_review.id == review.id
    assert other_review is None


def test_soft_delete_preserves_record_but_hides_review(
    db_session: Session,
) -> None:
    user = create_user(db_session)
    gym = create_gym(db_session)

    review = create_gym_review(
        db_session=db_session,
        user_id=user.id,
        gym_id=gym.id,
        rating=5,
        comment="Minha avaliacao",
    )

    remove_gym_review(
        db_session=db_session,
        user_id=user.id,
        review_id=review.id,
    )

    persisted = db_session.get(GymReview, review.id)

    assert persisted is not None
    assert persisted.removed_at is not None

    assert (
        list_gym_reviews(
            db_session=db_session,
            gym_id=gym.id,
        )
        == []
    )

    summary = get_gym_rating_summary(
        db_session=db_session,
        gym_id=gym.id,
    )

    assert summary.review_count == 0
    assert summary.average_rating is None


def test_user_can_review_again_after_soft_delete(
    db_session: Session,
) -> None:
    user = create_user(db_session)
    gym = create_gym(db_session)

    original = create_gym_review(
        db_session=db_session,
        user_id=user.id,
        gym_id=gym.id,
        rating=2,
        comment="Anterior",
    )

    remove_gym_review(
        db_session=db_session,
        user_id=user.id,
        review_id=original.id,
    )

    replacement = create_gym_review(
        db_session=db_session,
        user_id=user.id,
        gym_id=gym.id,
        rating=5,
        comment="Nova avaliacao",
    )

    assert replacement.id != original.id

    persisted = db_session.scalars(
        select(GymReview).where(
            GymReview.user_id == user.id,
            GymReview.gym_id == gym.id,
        )
    ).all()

    assert len(persisted) == 2

    active = list_gym_reviews(
        db_session=db_session,
        gym_id=gym.id,
    )

    assert [review.id for review in active] == [replacement.id]


def test_removed_review_cannot_be_updated(
    db_session: Session,
) -> None:
    user = create_user(db_session)
    gym = create_gym(db_session)

    review = create_gym_review(
        db_session=db_session,
        user_id=user.id,
        gym_id=gym.id,
        rating=5,
        comment=None,
    )

    remove_gym_review(
        db_session=db_session,
        user_id=user.id,
        review_id=review.id,
    )

    with pytest.raises(GymReviewNotFoundError):
        update_gym_review(
            db_session=db_session,
            user_id=user.id,
            review_id=review.id,
            rating=1,
        )


def test_removed_review_cannot_be_removed_twice(
    db_session: Session,
) -> None:
    user = create_user(db_session)
    gym = create_gym(db_session)

    review = create_gym_review(
        db_session=db_session,
        user_id=user.id,
        gym_id=gym.id,
        rating=5,
        comment=None,
    )

    remove_gym_review(
        db_session=db_session,
        user_id=user.id,
        review_id=review.id,
    )

    with pytest.raises(GymReviewNotFoundError):
        remove_gym_review(
            db_session=db_session,
            user_id=user.id,
            review_id=review.id,
        )


def test_listing_nonexistent_gym_is_rejected(
    db_session: Session,
) -> None:
    with pytest.raises(GymReviewGymNotFoundError):
        list_gym_reviews(
            db_session=db_session,
            gym_id=uuid4(),
        )


def test_summary_nonexistent_gym_is_rejected(
    db_session: Session,
) -> None:
    with pytest.raises(GymReviewGymNotFoundError):
        get_gym_rating_summary(
            db_session=db_session,
            gym_id=uuid4(),
        )
