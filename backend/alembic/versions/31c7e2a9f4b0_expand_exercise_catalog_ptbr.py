"""Expand the global exercise catalog with Brazilian Portuguese names.

Revision ID: 31c7e2a9f4b0
Revises: 3a467e3941e2

Preserves existing exercise IDs, custom exercises and execution snapshots.
"""

from collections.abc import Sequence
from uuid import UUID

import sqlalchemy as sa
from alembic import op

revision: str = "31c7e2a9f4b0"
down_revision: str | Sequence[str] | None = "3a467e3941e2"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


# Stable IDs and original names from the initial catalog migration.
# Never regenerate these IDs or rewrite the initial migration.
RENAMES = (
    ("00000000-0000-4000-8000-000000000001", "Barbell Bench Press", "Supino reto com barra"),
    (
        "00000000-0000-4000-8000-000000000002",
        "Incline Dumbbell Press",
        "Supino inclinado com halteres",
    ),
    ("00000000-0000-4000-8000-000000000003", "Push-up", "Flexão de braços"),
    (
        "00000000-0000-4000-8000-000000000004",
        "Lat Pulldown",
        "Puxada frontal na polia alta",
    ),
    (
        "00000000-0000-4000-8000-000000000005",
        "Seated Cable Row",
        "Remada sentada na polia baixa",
    ),
    ("00000000-0000-4000-8000-000000000006", "Barbell Row", "Remada curvada com barra"),
    (
        "00000000-0000-4000-8000-000000000007",
        "Back Squat",
        "Agachamento livre com barra",
    ),
    ("00000000-0000-4000-8000-000000000008", "Leg Press", "Leg press"),
    (
        "00000000-0000-4000-8000-000000000009",
        "Romanian Deadlift",
        "Levantamento terra romeno",
    ),
    ("00000000-0000-4000-8000-000000000010", "Leg Extension", "Cadeira extensora"),
    (
        "00000000-0000-4000-8000-000000000011",
        "Leg Curl",
        "Flexora de pernas na máquina",
    ),
    (
        "00000000-0000-4000-8000-000000000012",
        "Standing Calf Raise",
        "Elevação de panturrilhas em pé",
    ),
    (
        "00000000-0000-4000-8000-000000000013",
        "Overhead Press",
        "Desenvolvimento de ombros",
    ),
    (
        "00000000-0000-4000-8000-000000000014",
        "Dumbbell Lateral Raise",
        "Elevação lateral com halteres",
    ),
    (
        "00000000-0000-4000-8000-000000000015",
        "Barbell Biceps Curl",
        "Rosca direta com barra",
    ),
    (
        "00000000-0000-4000-8000-000000000016",
        "Dumbbell Biceps Curl",
        "Rosca bíceps com halteres",
    ),
    (
        "00000000-0000-4000-8000-000000000017",
        "Cable Triceps Pushdown",
        "Tríceps na polia alta",
    ),
    (
        "00000000-0000-4000-8000-000000000018",
        "Overhead Triceps Extension",
        "Extensão de tríceps acima da cabeça",
    ),
    ("00000000-0000-4000-8000-000000000019", "Plank", "Prancha isométrica"),
    ("00000000-0000-4000-8000-000000000020", "Crunch", "Abdominal curto"),
)


# The order is immutable because each position determines a stable UUID,
# starting at the suffix 000000000021.
ADDITIONAL_NAMES = (
    # Peito
    "Supino reto com halteres",
    "Supino inclinado com barra",
    "Supino declinado com barra",
    "Supino no Smith",
    "Supino na máquina convergente",
    "Crucifixo reto com halteres",
    "Crucifixo inclinado com halteres",
    "Crucifixo na máquina (peck deck)",
    "Crossover na polia alta",
    "Crossover na polia baixa",
    "Flexão de braços com mãos elevadas",
    # Costas
    "Barra fixa com pegada pronada",
    "Barra fixa com pegada supinada",
    "Barra fixa assistida na máquina",
    "Puxada frontal com pegada supinada",
    "Puxada frontal com pegada neutra",
    "Puxada unilateral na polia alta",
    "Remada unilateral com halter",
    "Remada articulada na máquina",
    "Remada cavalinho",
    "Remada curvada com halteres",
    "Pullover na polia alta",
    "Pullover com halter",
    "Hiperextensão lombar no banco",
    # Quadríceps e movimentos de agachamento
    "Agachamento frontal com barra",
    "Agachamento goblet com halter",
    "Agachamento no Smith",
    "Agachamento no hack",
    "Agachamento búlgaro com halteres",
    "Agachamento sumô com halter",
    "Leg press horizontal",
    "Passada caminhando com halteres",
    "Afundo reverso com halteres",
    "Subida no banco (step-up)",
    # Posteriores, glúteos e quadril
    "Levantamento terra convencional",
    "Stiff com barra",
    "Stiff com halteres",
    "Mesa flexora",
    "Cadeira flexora",
    "Flexão de joelhos em pé na máquina",
    "Elevação pélvica com barra",
    "Elevação pélvica na máquina",
    "Coice de glúteo na polia baixa",
    "Cadeira abdutora",
    "Cadeira adutora",
    "Abdução de quadril na polia baixa",
    # Ombros e trapézio
    "Desenvolvimento com halteres",
    "Desenvolvimento na máquina",
    "Desenvolvimento Arnold",
    "Elevação frontal com halteres",
    "Elevação lateral na polia baixa",
    "Crucifixo inverso na máquina",
    "Crucifixo inverso com halteres",
    "Face pull na polia alta",
    "Encolhimento com halteres",
    # Bíceps
    "Rosca alternada com halteres",
    "Rosca martelo com halteres",
    "Rosca Scott com barra W",
    "Rosca Scott na máquina",
    "Rosca concentrada com halter",
    "Rosca na polia baixa",
    "Rosca inclinada com halteres",
    # Tríceps
    "Tríceps testa com barra W",
    "Tríceps francês unilateral com halter",
    "Tríceps com corda na polia alta",
    "Tríceps com pegada inversa na polia",
    "Coice de tríceps com halter",
    "Mergulho nas paralelas",
    "Supino fechado com barra",
    # Panturrilhas
    "Elevação de panturrilhas sentado",
    "Elevação de panturrilhas no leg press",
    "Elevação unilateral de panturrilha em pé",
    # Abdômen e estabilidade do tronco
    "Prancha lateral",
    "Abdominal reverso",
    "Elevação de pernas deitado",
    "Elevação de joelhos na barra fixa",
    "Abdominal na polia alta",
    "Abdominal bicicleta",
    "Dead bug",
    "Bird dog",
)


exercises = sa.table(
    "exercises",
    sa.column("id", sa.Uuid(as_uuid=True)),
    sa.column("owner_user_id", sa.Uuid(as_uuid=True)),
    sa.column("name", sa.String(length=120)),
    sa.column("is_archived", sa.Boolean()),
)


def added_exercises() -> list[tuple[UUID, str]]:
    return [
        (
            UUID(f"00000000-0000-4000-8000-{number:012d}"),
            name,
        )
        for number, name in enumerate(ADDITIONAL_NAMES, start=21)
    ]


def upgrade() -> None:
    connection = op.get_bind()
    original_ids = [UUID(item[0]) for item in RENAMES]
    additions = added_exercises()
    new_ids = [item[0] for item in additions]

    original_rows = connection.execute(
        sa.select(
            exercises.c.id,
            exercises.c.name,
            exercises.c.owner_user_id,
        ).where(exercises.c.id.in_(original_ids))
    ).all()

    originals = {row.id: (row.name, row.owner_user_id) for row in original_rows}

    # Fail before writing if an existing catalog entry was modified
    # or a stable ID no longer belongs to the original global catalog.
    for raw_id, previous_name, _new_name in RENAMES:
        original = originals.get(UUID(raw_id))

        if original != (previous_name, None):
            raise RuntimeError(f"Original catalog entry is not in its expected state: {raw_id}")

    occupied_new_ids = connection.execute(
        sa.select(exercises.c.id).where(exercises.c.id.in_(new_ids))
    ).all()

    if occupied_new_ids:
        raise RuntimeError("One or more new catalog IDs are already occupied.")

    global_names = set(
        connection.scalars(
            sa.select(exercises.c.name).where(exercises.c.owner_user_id.is_(None))
        ).all()
    )

    desired_names = {new_name for _raw_id, _previous_name, new_name in RENAMES}
    desired_names.update(ADDITIONAL_NAMES)

    if global_names.intersection(desired_names):
        raise RuntimeError("Global catalog already contains one or more proposed Portuguese names.")

    for raw_id, previous_name, new_name in RENAMES:
        result = connection.execute(
            sa.update(exercises)
            .where(
                exercises.c.id == UUID(raw_id),
                exercises.c.owner_user_id.is_(None),
                exercises.c.name == previous_name,
            )
            .values(name=new_name)
        )

        if result.rowcount != 1:
            raise RuntimeError(f"Could not rename the expected global exercise: {raw_id}")

    op.bulk_insert(
        exercises,
        [
            {
                "id": identifier,
                "owner_user_id": None,
                "name": name,
                "is_archived": False,
            }
            for identifier, name in additions
        ],
    )


def downgrade() -> None:
    connection = op.get_bind()
    additions = added_exercises()
    new_ids = [item[0] for item in additions]

    # Do not remove catalog entries linked to planned or historical
    # exercises. Reverting a data migration must not discard user links.
    for table_name in ("workout_exercises", "exercise_executions"):
        references = sa.table(
            table_name,
            sa.column("exercise_id", sa.Uuid(as_uuid=True)),
        )

        count = connection.scalar(
            sa.select(sa.func.count())
            .select_from(references)
            .where(references.c.exercise_id.in_(new_ids))
        )

        if count:
            raise RuntimeError(f"Cannot downgrade: new exercises are referenced by {table_name}.")

    expected_rows = {identifier: name for identifier, name in additions}

    actual_rows = connection.execute(
        sa.select(
            exercises.c.id,
            exercises.c.name,
            exercises.c.owner_user_id,
        ).where(exercises.c.id.in_(new_ids))
    ).all()

    actual = {row.id: (row.name, row.owner_user_id) for row in actual_rows}

    if len(actual) != len(expected_rows):
        raise RuntimeError("New catalog entries are missing.")

    for identifier, name in expected_rows.items():
        if actual.get(identifier) != (name, None):
            raise RuntimeError(f"New catalog entry was modified: {identifier}")

    for raw_id, _previous_name, portuguese_name in RENAMES:
        current = connection.execute(
            sa.select(
                exercises.c.name,
                exercises.c.owner_user_id,
            ).where(exercises.c.id == UUID(raw_id))
        ).one_or_none()

        if current is None or tuple(current) != (portuguese_name, None):
            raise RuntimeError(f"Translated catalog entry was modified: {raw_id}")

    result = connection.execute(
        sa.delete(exercises).where(
            exercises.c.id.in_(new_ids),
            exercises.c.owner_user_id.is_(None),
        )
    )

    if result.rowcount != len(new_ids):
        raise RuntimeError("Could not remove all added catalog entries.")

    for raw_id, previous_name, portuguese_name in RENAMES:
        result = connection.execute(
            sa.update(exercises)
            .where(
                exercises.c.id == UUID(raw_id),
                exercises.c.owner_user_id.is_(None),
                exercises.c.name == portuguese_name,
            )
            .values(name=previous_name)
        )

        if result.rowcount != 1:
            raise RuntimeError(f"Could not restore original catalog entry: {raw_id}")
