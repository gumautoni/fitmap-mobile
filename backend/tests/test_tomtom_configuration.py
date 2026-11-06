import asyncio

import httpx2
import pytest
from pydantic import SecretStr, ValidationError
from pydantic_settings import SettingsConfigDict

from fitmap.gyms.config import TomTomProviderSettings
from fitmap.gyms.factory import create_tomtom_gym_provider


class _IsolatedTomTomProviderSettings(TomTomProviderSettings):
    model_config = SettingsConfigDict(env_file=None)


def test_tomtom_settings_load_environment(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv(
        "FITMAP_TOMTOM_API_KEY",
        "test-tomtom-api-key",
    )
    monkeypatch.setenv(
        "FITMAP_TOMTOM_TIMEOUT_SECONDS",
        "12.5",
    )

    settings = _IsolatedTomTomProviderSettings()

    assert settings.api_key is not None
    assert settings.api_key.get_secret_value() == "test-tomtom-api-key"
    assert settings.timeout_seconds == 12.5


def test_tomtom_settings_default_to_optional_key(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("FITMAP_TOMTOM_API_KEY", raising=False)
    monkeypatch.delenv("FITMAP_TOMTOM_TIMEOUT_SECONDS", raising=False)

    settings = _IsolatedTomTomProviderSettings()

    assert settings.api_key is None
    assert settings.timeout_seconds == 10.0


@pytest.mark.parametrize("timeout", [0.0, -1.0, 61.0])
def test_tomtom_settings_reject_invalid_timeout(
    timeout: float,
) -> None:
    with pytest.raises(ValidationError):
        _IsolatedTomTomProviderSettings(
            api_key=None,
            timeout_seconds=timeout,
        )


def test_tomtom_settings_do_not_expose_secret_in_repr() -> None:
    settings = _IsolatedTomTomProviderSettings(
        api_key=SecretStr("secret-for-test-only"),
    )

    assert "secret-for-test-only" not in repr(settings)


def test_tomtom_factory_does_not_activate_without_key() -> None:
    async def run_test() -> None:
        async with httpx2.AsyncClient() as client:
            settings = _IsolatedTomTomProviderSettings(
                api_key=None,
            )

            provider = create_tomtom_gym_provider(
                settings=settings,
                client=client,
            )

            assert provider is None

    asyncio.run(run_test())


def test_tomtom_factory_rejects_blank_key() -> None:
    async def run_test() -> None:
        async with httpx2.AsyncClient() as client:
            settings = _IsolatedTomTomProviderSettings(
                api_key=SecretStr("   "),
            )

            provider = create_tomtom_gym_provider(
                settings=settings,
                client=client,
            )

            assert provider is None

    asyncio.run(run_test())


def test_tomtom_factory_uses_server_side_key() -> None:
    def handler(request: httpx2.Request) -> httpx2.Response:
        assert request.method == "POST"
        assert request.url.path == "/maps/orbis/places/discover"
        assert request.headers["TomTom-Api-Key"] == "test-api-key"
        assert request.headers["TomTom-Api-Version"] == "3"
        assert "test-api-key" not in str(request.url)

        return httpx2.Response(
            200,
            json={"results": []},
        )

    async def run_test() -> None:
        settings = _IsolatedTomTomProviderSettings(
            api_key=SecretStr("test-api-key"),
            timeout_seconds=12.0,
        )

        async with httpx2.AsyncClient(transport=httpx2.MockTransport(handler)) as client:
            provider = create_tomtom_gym_provider(
                settings=settings,
                client=client,
            )

            assert provider is not None

            results = await provider.search_nearby(
                latitude=-22.47034,
                longitude=-43.82633,
                radius_meters=5000,
            )

            assert results == []

    asyncio.run(run_test())
