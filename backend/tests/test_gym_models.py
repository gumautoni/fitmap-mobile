from collections.abc import Iterator
from uuid import uuid4

import pytest
from sqlalchemy import Engine, delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from fitmap.gyms.models import FavoriteGym, Gym, GymExternalReference
from fitmap.identity.models import User


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
    *,
    name: str = "Gym User",
) -> User:
    user = User(
        name=name,
        email=f"gym-{uuid4()}@example.com",
        password_hash="test-password-hash",
    )

    db_session.add(user)
    db_session.flush()

    return user


def create_gym(
    db_session: Session,
    *,
    name: str = "FitMap Test Gym",
) -> Gym:
    gym = Gym(
        name=name,
        address="Rua de Teste, 100",
        latitude=-22.4700,
        longitude=-43.8250,
    )

    db_session.add(gym)
    db_session.flush()

    return gym


def create_external_reference(
    db_session: Session,
    *,
    gym: Gym,
    external_id: str = "geoapify-test-gym",
) -> GymExternalReference:
    reference = GymExternalReference(
        gym_id=gym.id,
        provider_name="geoapify",
        external_id=external_id,
    )

    db_session.add(reference)
    db_session.flush()

    return reference


def test_gym_uses_internal_identity_independent_from_provider_reference(
    db_session: Session,
) -> None:
    gym = create_gym(db_session)
    reference = create_external_reference(
        db_session,
        gym=gym,
    )

    persisted_gym = db_session.scalar(
        select(Gym).where(
            Gym.id == gym.id,
        )
    )
    persisted_reference = db_session.scalar(
        select(GymExternalReference).where(
            GymExternalReference.id == reference.id,
        )
    )

    assert persisted_gym is not None
    assert persisted_reference is not None
    assert persisted_reference.gym_id == persisted_gym.id
    assert persisted_reference.external_id == "geoapify-test-gym"
    assert str(persisted_gym.id) != persisted_reference.external_id


def test_provider_external_reference_must_be_unique(
    db_session: Session,
) -> None:
    first_gym = create_gym(
        db_session,
        name="First Gym",
    )
    second_gym = create_gym(
        db_session,
        name="Second Gym",
    )

    create_external_reference(
        db_session,
        gym=first_gym,
        external_id="shared-provider-id",
    )

    duplicate_reference = GymExternalReference(
        gym_id=second_gym.id,
        provider_name="geoapify",
        external_id="shared-provider-id",
    )

    db_session.add(duplicate_reference)

    with pytest.raises(IntegrityError):
        db_session.flush()


def test_same_gym_cannot_have_duplicate_reference_for_provider(
    db_session: Session,
) -> None:
    gym = create_gym(db_session)

    create_external_reference(
        db_session,
        gym=gym,
        external_id="first-reference",
    )

    duplicate_provider_reference = GymExternalReference(
        gym_id=gym.id,
        provider_name="geoapify",
        external_id="second-reference",
    )

    db_session.add(duplicate_provider_reference)

    with pytest.raises(IntegrityError):
        db_session.flush()


def test_user_can_favorite_gym(
    db_session: Session,
) -> None:
    user = create_user(db_session)
    gym = create_gym(db_session)

    favorite = FavoriteGym(
        user_id=user.id,
        gym_id=gym.id,
    )

    db_session.add(favorite)
    db_session.flush()

    persisted = db_session.scalar(
        select(FavoriteGym).where(
            FavoriteGym.id == favorite.id,
        )
    )

    assert persisted is not None
    assert persisted.user_id == user.id
    assert persisted.gym_id == gym.id


def test_same_user_cannot_favorite_same_gym_twice(
    db_session: Session,
) -> None:
    user = create_user(db_session)
    gym = create_gym(db_session)

    first_favorite = FavoriteGym(
        user_id=user.id,
        gym_id=gym.id,
    )
    second_favorite = FavoriteGym(
        user_id=user.id,
        gym_id=gym.id,
    )

    db_session.add(first_favorite)
    db_session.flush()

    db_session.add(second_favorite)

    with pytest.raises(IntegrityError):
        db_session.flush()


def test_different_users_can_favorite_same_gym(
    db_session: Session,
) -> None:
    first_user = create_user(
        db_session,
        name="First User",
    )
    second_user = create_user(
        db_session,
        name="Second User",
    )
    gym = create_gym(db_session)

    db_session.add_all(
        [
            FavoriteGym(
                user_id=first_user.id,
                gym_id=gym.id,
            ),
            FavoriteGym(
                user_id=second_user.id,
                gym_id=gym.id,
            ),
        ]
    )
    db_session.flush()

    favorites = db_session.scalars(
        select(FavoriteGym).where(
            FavoriteGym.gym_id == gym.id,
        )
    ).all()

    assert len(favorites) == 2
    assert {favorite.user_id for favorite in favorites} == {
        first_user.id,
        second_user.id,
    }


def test_removing_favorite_preserves_gym(
    db_session: Session,
) -> None:
    user = create_user(db_session)
    gym = create_gym(db_session)

    favorite = FavoriteGym(
        user_id=user.id,
        gym_id=gym.id,
    )

    db_session.add(favorite)
    db_session.flush()

    favorite_id = favorite.id
    gym_id = gym.id

    db_session.execute(
        delete(FavoriteGym).where(
            FavoriteGym.id == favorite_id,
        )
    )
    db_session.flush()
    db_session.expire_all()

    persisted_favorite = db_session.scalar(
        select(FavoriteGym).where(
            FavoriteGym.id == favorite_id,
        )
    )
    persisted_gym = db_session.scalar(
        select(Gym).where(
            Gym.id == gym_id,
        )
    )

    assert persisted_favorite is None
    assert persisted_gym is not None


def test_deleting_user_removes_only_their_favorites(
    db_session: Session,
) -> None:
    first_user = create_user(
        db_session,
        name="First User",
    )
    second_user = create_user(
        db_session,
        name="Second User",
    )
    gym = create_gym(db_session)

    first_favorite = FavoriteGym(
        user_id=first_user.id,
        gym_id=gym.id,
    )
    second_favorite = FavoriteGym(
        user_id=second_user.id,
        gym_id=gym.id,
    )

    db_session.add_all(
        [
            first_favorite,
            second_favorite,
        ]
    )
    db_session.flush()

    first_user_id = first_user.id
    second_user_id = second_user.id
    gym_id = gym.id

    db_session.execute(
        delete(User).where(
            User.id == first_user_id,
        )
    )
    db_session.flush()
    db_session.expire_all()

    first_user_favorites = db_session.scalars(
        select(FavoriteGym).where(
            FavoriteGym.user_id == first_user_id,
        )
    ).all()
    second_user_favorites = db_session.scalars(
        select(FavoriteGym).where(
            FavoriteGym.user_id == second_user_id,
        )
    ).all()
    persisted_gym = db_session.scalar(
        select(Gym).where(
            Gym.id == gym_id,
        )
    )

    assert first_user_favorites == []
    assert len(second_user_favorites) == 1
    assert second_user_favorites[0].gym_id == gym_id
    assert persisted_gym is not None


@pytest.mark.parametrize(
    (
        "latitude",
        "longitude",
    ),
    [
        (
            None,
            -43.8250,
        ),
        (
            -22.4700,
            None,
        ),
        (
            -91.0,
            -43.8250,
        ),
        (
            91.0,
            -43.8250,
        ),
        (
            -22.4700,
            -181.0,
        ),
        (
            -22.4700,
            181.0,
        ),
    ],
)
def test_gym_rejects_invalid_coordinates(
    db_session: Session,
    latitude: float | None,
    longitude: float | None,
) -> None:
    gym = Gym(
        name="Invalid Coordinates Gym",
        latitude=latitude,
        longitude=longitude,
    )

    db_session.add(gym)

    with pytest.raises(IntegrityError):
        db_session.flush()
