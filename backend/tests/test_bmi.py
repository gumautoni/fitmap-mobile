from decimal import Decimal

import pytest

from fitmap.progress.bmi import calculate_bmi


@pytest.mark.parametrize(
    ("weight", "height", "expected"),
    [
        ("70", "175", "22.9"),
        ("80", "180", "24.7"),
        ("80", "160", "31.3"),
    ],
)
def test_calculate_bmi_rounds_to_one_decimal(weight: str, height: str, expected: str) -> None:
    result = calculate_bmi(
        weight_kg=Decimal(weight),
        height_cm=Decimal(height),
    )

    assert result == Decimal(expected)


@pytest.mark.parametrize(
    ("weight", "height"),
    [
        ("0", "170"),
        ("-1", "170"),
        ("Infinity", "170"),
        ("NaN", "170"),
        ("80", "0"),
        ("80", "-1"),
        ("80", "Infinity"),
        ("80", "NaN"),
    ],
)
def test_calculate_bmi_rejects_invalid_values(weight: str, height: str) -> None:
    with pytest.raises(ValueError, match="positive finite"):
        calculate_bmi(
            weight_kg=Decimal(weight),
            height_cm=Decimal(height),
        )
