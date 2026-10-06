import pytest

from fitmap.gyms.config import GymProviderSettings


def _load_settings() -> GymProviderSettings:
    return GymProviderSettings()  # pyright: ignore[reportCallIssue]


def test_gym_provider_settings_load_geoapify_environment(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv(
        "FITMAP_GEOAPIFY_API_KEY",
        "test-geoapify-api-key",
    )
    monkeypatch.setenv(
        "FITMAP_GEOAPIFY_TIMEOUT_SECONDS",
        "7.5",
    )

    settings = _load_settings()

    assert settings.api_key.get_secret_value() == "test-geoapify-api-key"
    assert settings.timeout_seconds == 7.5


def test_gym_provider_settings_uses_default_timeout(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv(
        "FITMAP_GEOAPIFY_API_KEY",
        "test-geoapify-api-key",
    )
    monkeypatch.delenv(
        "FITMAP_GEOAPIFY_TIMEOUT_SECONDS",
        raising=False,
    )

    settings = _load_settings()

    assert settings.timeout_seconds == 5.0
