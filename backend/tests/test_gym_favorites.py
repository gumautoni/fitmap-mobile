from collections.abc import Iterator
from uuid import uuid4

import pytest
from sqlalchemy import Engine, select
from sqlalchemy.orm import Session

from fitmap.gyms.favorites import (
    FavoriteGymAlreadyExistsError,
    FavoriteGymNotFoundError,
    add_favorite_gym,
    list_favorite_gyms,
    remove_favorite_gym,
    resolve_gym_identity,
)
from fitmap.gyms.models import FavoriteGym, Gym, GymExternalReference
from fitmap.gyms.providers import Coordinates, GymSearchResult
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
    name: str = "Favorite Gym User",
) -> User:
    user = User(
        name=name,
        email=f"favorite-gym-{uuid4()}@example.com",
        password_hash="test-password-hash",
    )

    db_session.add(user)
    db_session.flush()

    return user


def build_provider_gym(
    *,
    external_id: str = "geoapify-favorite-gym",
    name: str = "Favorite Test Gym",
) -> GymSearchResult:
    return GymSearchResult(
        provider_name="geoapify",
        external_id=external_id,
        name=name,
        coordinates=Coordinates(
            latitude=-22.4700,
            longitude=-43.8250,
        ),
        address="Rua de Teste, 100",
    )


def test_resolve_gym_identity_creates_internal_gym_and_external_reference(
    db_session: Session,
) -> None:
    provider_gym = build_provider_gym()

    gym = resolve_gym_identity(
        db_session=db_session,
        provider_gym=provider_gym,
    )

    persisted_gym = db_session.get(
        Gym,
        gym.id,
    )
    external_reference = db_session.scalar(
        select(GymExternalReference).where(
            GymExternalReference.gym_id == gym.id,
        )
    )

    assert persisted_gym is not None
    assert persisted_gym.name == "Favorite Test Gym"
    assert persisted_gym.address == "Rua de Teste, 100"
    assert persisted_gym.latitude == pytest.approx(-22.4700)
    assert persisted_gym.longitude == pytest.approx(-43.8250)

    assert external_reference is not None
    assert external_reference.provider_name == "geoapify"
    assert external_reference.external_id == "geoapify-favorite-gym"


def test_resolve_gym_identity_reuses_existing_internal_gym(
    db_session: Session,
) -> None:
    provider_gym = build_provider_gym()

    first_gym = resolve_gym_identity(
        db_session=db_session,
        provider_gym=provider_gym,
    )
    second_gym = resolve_gym_identity(
        db_session=db_session,
        provider_gym=provider_gym,
    )

    gyms = db_session.scalars(
        select(Gym),
    ).all()
    references = db_session.scalars(
        select(GymExternalReference),
    ).all()

    assert second_gym.id == first_gym.id
    assert len(gyms) == 1
    assert len(references) == 1


def test_add_favorite_gym_creates_favorite_for_authenticated_user(
    db_session: Session,
) -> None:
    user = create_user(db_session)
    provider_gym = build_provider_gym()

    favorite = add_favorite_gym(
        db_session=db_session,
        user_id=user.id,
        provider_gym=provider_gym,
    )

    gym = db_session.get(
        Gym,
        favorite.gym_id,
    )

    assert favorite.user_id == user.id
    assert gym is not None
    assert gym.name == "Favorite Test Gym"


def test_same_user_cannot_add_same_gym_to_favorites_twice(
    db_session: Session,
) -> None:
    user = create_user(db_session)
    provider_gym = build_provider_gym()

    add_favorite_gym(
        db_session=db_session,
        user_id=user.id,
        provider_gym=provider_gym,
    )

    with pytest.raises(
        FavoriteGymAlreadyExistsError,
        match="already in the user's favorites",
    ):
        add_favorite_gym(
            db_session=db_session,
            user_id=user.id,
            provider_gym=provider_gym,
        )

    favorites = db_session.scalars(
        select(FavoriteGym).where(
            FavoriteGym.user_id == user.id,
        )
    ).all()

    assert len(favorites) == 1


def test_different_users_share_same_internal_gym_identity(
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
    provider_gym = build_provider_gym()

    first_favorite = add_favorite_gym(
        db_session=db_session,
        user_id=first_user.id,
        provider_gym=provider_gym,
    )
    second_favorite = add_favorite_gym(
        db_session=db_session,
        user_id=second_user.id,
        provider_gym=provider_gym,
    )

    assert first_favorite.gym_id == second_favorite.gym_id

    gyms = db_session.scalars(
        select(Gym),
    ).all()

    assert len(gyms) == 1


def test_list_favorite_gyms_isolated_between_users(
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

    first_favorite = add_favorite_gym(
        db_session=db_session,
        user_id=first_user.id,
        provider_gym=build_provider_gym(
            external_id="first-gym",
            name="First Gym",
        ),
    )
    add_favorite_gym(
        db_session=db_session,
        user_id=second_user.id,
        provider_gym=build_provider_gym(
            external_id="second-gym",
            name="Second Gym",
        ),
    )

    first_user_favorites = list_favorite_gyms(
        db_session=db_session,
        user_id=first_user.id,
    )

    assert len(first_user_favorites) == 1
    assert first_user_favorites[0].favorite_id == first_favorite.id
    assert first_user_favorites[0].gym_id == first_favorite.gym_id
    assert first_user_favorites[0].name == "First Gym"


def test_remove_favorite_preserves_gym_and_external_reference(
    db_session: Session,
) -> None:
    user = create_user(db_session)

    favorite = add_favorite_gym(
        db_session=db_session,
        user_id=user.id,
        provider_gym=build_provider_gym(),
    )

    gym_id = favorite.gym_id

    external_reference = db_session.scalar(
        select(GymExternalReference).where(
            GymExternalReference.gym_id == gym_id,
        )
    )

    assert external_reference is not None
    external_reference_id = external_reference.id

    remove_favorite_gym(
        db_session=db_session,
        user_id=user.id,
        gym_id=gym_id,
    )

    persisted_favorite = db_session.scalar(
        select(FavoriteGym).where(
            FavoriteGym.user_id == user.id,
            FavoriteGym.gym_id == gym_id,
        )
    )
    persisted_gym = db_session.get(
        Gym,
        gym_id,
    )
    persisted_reference = db_session.get(
        GymExternalReference,
        external_reference_id,
    )

    assert persisted_favorite is None
    assert persisted_gym is not None
    assert persisted_reference is not None


def test_user_cannot_remove_another_users_favorite(
    db_session: Session,
) -> None:
    owner = create_user(
        db_session,
        name="Owner",
    )
    other_user = create_user(
        db_session,
        name="Other User",
    )

    favorite = add_favorite_gym(
        db_session=db_session,
        user_id=owner.id,
        provider_gym=build_provider_gym(),
    )

    with pytest.raises(
        FavoriteGymNotFoundError,
        match="Favorite gym was not found",
    ):
        remove_favorite_gym(
            db_session=db_session,
            user_id=other_user.id,
            gym_id=favorite.gym_id,
        )

    owner_favorites = list_favorite_gyms(
        db_session=db_session,
        user_id=owner.id,
    )

    assert len(owner_favorites) == 1
    assert owner_favorites[0].favorite_id == favorite.id
    assert owner_favorites[0].gym_id == favorite.gym_id
