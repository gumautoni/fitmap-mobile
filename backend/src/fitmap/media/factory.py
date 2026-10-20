from __future__ import annotations

from typing import TYPE_CHECKING

import boto3
from botocore.config import Config

from fitmap.media.config import MediaStorageSettings
from fitmap.media.s3 import S3PrivateObjectStorage
from fitmap.media.storage import PrivateObjectStorage

if TYPE_CHECKING:
    from mypy_boto3_s3 import S3Client


def create_private_object_storage(
    *,
    settings: MediaStorageSettings,
) -> PrivateObjectStorage:
    client_config = (
        Config(
            s3={
                "addressing_style": "path",
            }
        )
        if settings.endpoint_url
        else None
    )

    client: S3Client = boto3.client(  # pyright: ignore[reportUnknownMemberType]
        "s3",
        region_name=settings.region_name,
        endpoint_url=settings.endpoint_url,
        aws_access_key_id=settings.access_key_id.get_secret_value(),
        aws_secret_access_key=settings.secret_access_key.get_secret_value(),
        config=client_config,
    )

    return S3PrivateObjectStorage(
        client=client,
        bucket_name=settings.bucket_name,
    )
