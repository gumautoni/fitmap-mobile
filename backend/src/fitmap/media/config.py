from functools import lru_cache
from pathlib import Path

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

_BACKEND_DIR = Path(__file__).resolve().parents[3]


class MediaStorageSettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        env_prefix="FITMAP_MEDIA_",
        extra="ignore",
    )

    bucket_name: str
    region_name: str = "us-east-1"
    endpoint_url: str | None = None
    access_key_id: SecretStr
    secret_access_key: SecretStr


@lru_cache
def get_media_storage_settings() -> MediaStorageSettings:
    return MediaStorageSettings()  # pyright: ignore[reportCallIssue]
