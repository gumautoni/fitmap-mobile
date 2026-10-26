from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from uuid import UUID, uuid4

from sqlalchemy import Engine, delete, event, select
from sqlalchemy.orm import Session

from fitmap.gyms.favorites import resolve_gym_identity
from fitmap.gyms.models import Gym, GymExternalReference
from fitmap.gyms.providers import GymSearchResult


def test_concurrent_requests_share_one_gym_identity(
    database_engine: Engine,
) -> None:
    external_id = f"concurrent-gym-{uuid4()}"
    gym_name = f"Concurrent Test Gym {uuid4()}"
    barrier = Barrier(2, timeout=15)

    provider_gym = GymSearchResult(
        provider_name="geoapify",
        external_id=external_id,
        name=gym_name,
        address="Rua de Teste, 100",
    )

    def resolve_in_parallel() -> UUID:
        with Session(
            database_engine,
            expire_on_commit=False,
        ) as session:

            def synchronize_gym_inserts(
                current_session: Session,
                _flush_context: object,
            ) -> None:
                inserted_our_gym = any(
                    isinstance(obj, Gym) and obj.name == gym_name for obj in current_session.new
                )

                if inserted_our_gym:
                    barrier.wait()

            event.listen(
                session,
                "after_flush",
                synchronize_gym_inserts,
            )

            gym = resolve_gym_identity(
                db_session=session,
                provider_gym=provider_gym,
            )

            gym_id = gym.id

            session.commit()

            return gym_id

    try:
        with ThreadPoolExecutor(max_workers=2) as executor:
            futures = [executor.submit(resolve_in_parallel) for _ in range(2)]

            gym_ids = [future.result(timeout=30) for future in futures]

        assert gym_ids[0] == gym_ids[1]

        with database_engine.connect() as connection:
            reference_ids = connection.scalars(
                select(GymExternalReference.gym_id).where(
                    GymExternalReference.provider_name == "geoapify",
                    GymExternalReference.external_id == external_id,
                )
            ).all()

            persisted_gyms = connection.scalars(
                select(Gym.id).where(
                    Gym.name == gym_name,
                )
            ).all()

        assert reference_ids == [gym_ids[0]]
        assert persisted_gyms == [gym_ids[0]]

    finally:
        with database_engine.begin() as connection:
            gym_ids_to_remove = select(GymExternalReference.gym_id).where(
                GymExternalReference.provider_name == "geoapify",
                GymExternalReference.external_id == external_id,
            )

            connection.execute(delete(Gym).where(Gym.id.in_(gym_ids_to_remove)))
