from functools import lru_cache
from pathlib import Path

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

_BACKEND_DIR = Path(__file__).resolve().parents[3]


class GymProviderSettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        env_prefix="FITMAP_GEOAPIFY_",
        extra="ignore",
    )

    api_key: SecretStr
    timeout_seconds: float = 5.0


@lru_cache
def get_gym_provider_settings() -> GymProviderSettings:
    return GymProviderSettings()  # pyright: ignore[reportCallIssue]
