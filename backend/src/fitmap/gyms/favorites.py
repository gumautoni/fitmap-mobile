from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from fitmap.gyms.models import FavoriteGym, Gym, GymExternalReference
from fitmap.gyms.providers import GymSearchResult


class FavoriteGymError(Exception):
    pass


class FavoriteGymAlreadyExistsError(FavoriteGymError):
    pass


class FavoriteGymNotFoundError(FavoriteGymError):
    pass


@dataclass(frozen=True, slots=True)
class FavoriteGymView:
    favorite_id: UUID
    gym_id: UUID
    provider_name: str
    external_id: str
    name: str
    address: str | None
    latitude: float | None
    longitude: float | None
    favorited_at: datetime


def _get_existing_gym(
    *,
    db_session: Session,
    provider_gym: GymSearchResult,
) -> Gym | None:
    external_reference = db_session.scalar(
        select(GymExternalReference).where(
            GymExternalReference.provider_name == provider_gym.provider_name,
            GymExternalReference.external_id == provider_gym.external_id,
        )
    )

    if external_reference is None:
        return None

    gym = db_session.get(
        Gym,
        external_reference.gym_id,
    )

    if gym is None:
        raise RuntimeError(
            "Gym external reference points to a missing gym.",
        )

    return gym


def resolve_gym_identity(
    *,
    db_session: Session,
    provider_gym: GymSearchResult,
) -> Gym:
    existing_gym = _get_existing_gym(
        db_session=db_session,
        provider_gym=provider_gym,
    )

    if existing_gym is not None:
        return existing_gym

    coordinates = provider_gym.coordinates

    try:
        with db_session.begin_nested():
            gym = Gym(
                name=provider_gym.name,
                address=provider_gym.address,
                latitude=(coordinates.latitude if coordinates is not None else None),
                longitude=(coordinates.longitude if coordinates is not None else None),
            )

            db_session.add(gym)
            db_session.flush()

            external_reference = GymExternalReference(
                gym_id=gym.id,
                provider_name=provider_gym.provider_name,
                external_id=provider_gym.external_id,
            )

            db_session.add(external_reference)
            db_session.flush()

    except IntegrityError as exc:
        diagnostic = getattr(exc.orig, "diag", None)
        constraint_name = getattr(
            diagnostic,
            "constraint_name",
            None,
        )

        if constraint_name != "uq_gym_external_references_provider_external_id":
            raise

        existing_gym = _get_existing_gym(
            db_session=db_session,
            provider_gym=provider_gym,
        )

        if existing_gym is None:
            raise

        return existing_gym

    return gym


def add_favorite_gym(
    *,
    db_session: Session,
    user_id: UUID,
    provider_gym: GymSearchResult,
) -> FavoriteGym:
    gym = resolve_gym_identity(
        db_session=db_session,
        provider_gym=provider_gym,
    )

    existing_favorite = db_session.scalar(
        select(FavoriteGym).where(
            FavoriteGym.user_id == user_id,
            FavoriteGym.gym_id == gym.id,
        )
    )

    if existing_favorite is not None:
        raise FavoriteGymAlreadyExistsError(
            "Gym is already in the user's favorites.",
        )

    favorite = FavoriteGym(
        user_id=user_id,
        gym_id=gym.id,
    )

    db_session.add(favorite)
    db_session.flush()

    return favorite


def get_favorite_gym_view(
    *,
    db_session: Session,
    user_id: UUID,
    gym_id: UUID,
) -> FavoriteGymView:
    favorite = db_session.scalar(
        select(FavoriteGym).where(
            FavoriteGym.user_id == user_id,
            FavoriteGym.gym_id == gym_id,
        )
    )

    if favorite is None:
        raise FavoriteGymNotFoundError(
            "Favorite gym was not found.",
        )

    return _build_favorite_gym_view(
        db_session=db_session,
        favorite=favorite,
    )


def list_favorite_gyms(
    *,
    db_session: Session,
    user_id: UUID,
) -> list[FavoriteGymView]:
    statement = (
        select(FavoriteGym)
        .where(
            FavoriteGym.user_id == user_id,
        )
        .order_by(
            FavoriteGym.created_at.desc(),
            FavoriteGym.id.desc(),
        )
    )

    favorites = db_session.scalars(statement).all()

    return [
        _build_favorite_gym_view(
            db_session=db_session,
            favorite=favorite,
        )
        for favorite in favorites
    ]


def remove_favorite_gym(
    *,
    db_session: Session,
    user_id: UUID,
    gym_id: UUID,
) -> None:
    favorite = db_session.scalar(
        select(FavoriteGym).where(
            FavoriteGym.user_id == user_id,
            FavoriteGym.gym_id == gym_id,
        )
    )

    if favorite is None:
        raise FavoriteGymNotFoundError(
            "Favorite gym was not found.",
        )

    db_session.delete(favorite)
    db_session.flush()


def _build_favorite_gym_view(
    *,
    db_session: Session,
    favorite: FavoriteGym,
) -> FavoriteGymView:
    gym = db_session.get(
        Gym,
        favorite.gym_id,
    )

    if gym is None:
        raise RuntimeError(
            "Favorite gym points to a missing gym.",
        )

    external_reference = db_session.scalar(
        select(GymExternalReference)
        .where(
            GymExternalReference.gym_id == gym.id,
        )
        .order_by(
            GymExternalReference.created_at.asc(),
            GymExternalReference.id.asc(),
        )
    )

    if external_reference is None:
        raise RuntimeError(
            "Favorite gym does not have an external reference.",
        )

    return FavoriteGymView(
        favorite_id=favorite.id,
        gym_id=gym.id,
        provider_name=external_reference.provider_name,
        external_id=external_reference.external_id,
        name=gym.name,
        address=gym.address,
        latitude=gym.latitude,
        longitude=gym.longitude,
        favorited_at=favorite.created_at,
    )
