import pytest
from pydantic import ValidationError

from fitmap.gyms.providers import Coordinates, GymDetails, GymSearchResult


def test_coordinates_accept_valid_values() -> None:
    coordinates = Coordinates(
        latitude=-22.4708,
        longitude=-43.8258,
    )

    assert coordinates.latitude == -22.4708
    assert coordinates.longitude == -43.8258


@pytest.mark.parametrize(
    ("latitude", "longitude"),
    [
        (-91, 0),
        (91, 0),
        (0, -181),
        (0, 181),
    ],
)
def test_coordinates_reject_out_of_range_values(
    latitude: float,
    longitude: float,
) -> None:
    with pytest.raises(ValidationError):
        Coordinates(
            latitude=latitude,
            longitude=longitude,
        )


def test_gym_search_result_keeps_unavailable_information_empty() -> None:
    result = GymSearchResult(
        provider_name="test-provider",
        external_id="gym-123",
        name="Test Gym",
    )

    assert result.provider_name == "test-provider"
    assert result.external_id == "gym-123"
    assert result.name == "Test Gym"
    assert result.coordinates is None
    assert result.address is None


def test_gym_details_keeps_optional_provider_data_unavailable() -> None:
    details = GymDetails(
        provider_name="test-provider",
        external_id="gym-123",
        name="Test Gym",
    )

    assert details.phone is None
    assert details.website is None
    assert details.opening_hours is None
    assert details.image_urls == []
    assert details.amenities == []
