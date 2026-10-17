from io import BytesIO
from uuid import UUID

import boto3
import pytest
from botocore.response import StreamingBody
from botocore.stub import Stubber
from mypy_boto3_s3 import S3Client

from fitmap.media.s3 import S3PrivateObjectStorage
from fitmap.media.storage import (
    ObjectNotFoundError,
    ObjectStorageError,
    build_progress_photo_storage_key,
)


def create_s3_storage() -> tuple[S3PrivateObjectStorage, Stubber]:
    client: S3Client = boto3.client(  # pyright: ignore[reportUnknownMemberType]
        "s3",
        region_name="us-east-1",
        aws_access_key_id="test-access-key",
        aws_secret_access_key="test-secret-key",
    )
    stubber = Stubber(client)

    storage = S3PrivateObjectStorage(
        client=client,
        bucket_name="fitmap-private-media",
    )

    return storage, stubber


def test_progress_photo_storage_key_is_generated_for_user() -> None:
    user_id = UUID("12345678-1234-5678-1234-567812345678")

    key = build_progress_photo_storage_key(
        user_id=user_id,
    )

    assert key.startswith("progress-photos/12345678-1234-5678-1234-567812345678/")
    assert len(key.rsplit("/", maxsplit=1)[1]) == 32


def test_put_object_stores_private_media() -> None:
    storage, stubber = create_s3_storage()

    stubber.add_response(
        "put_object",
        {},
        {
            "Bucket": "fitmap-private-media",
            "Key": "progress-photos/user/photo",
            "Body": b"image-data",
            "ContentType": "image/jpeg",
        },
    )

    with stubber:
        storage.put_object(
            key="progress-photos/user/photo",
            data=b"image-data",
            media_type="image/jpeg",
        )


def test_get_object_returns_media() -> None:
    storage, stubber = create_s3_storage()

    body = StreamingBody(
        BytesIO(b"image-data"),
        len(b"image-data"),
    )

    stubber.add_response(
        "get_object",
        {
            "Body": body,
            "ContentType": "image/jpeg",
        },
        {
            "Bucket": "fitmap-private-media",
            "Key": "progress-photos/user/photo",
        },
    )

    with stubber:
        media = storage.get_object(
            key="progress-photos/user/photo",
        )

    assert media.data == b"image-data"
    assert media.media_type == "image/jpeg"


def test_missing_object_is_reported() -> None:
    storage, stubber = create_s3_storage()

    stubber.add_client_error(
        "get_object",
        service_error_code="NoSuchKey",
        service_message="Not found",
        http_status_code=404,
        expected_params={
            "Bucket": "fitmap-private-media",
            "Key": "progress-photos/user/missing",
        },
    )

    with stubber, pytest.raises(ObjectNotFoundError):
        storage.get_object(
            key="progress-photos/user/missing",
        )


def test_missing_content_type_is_rejected() -> None:
    storage, stubber = create_s3_storage()

    body = StreamingBody(
        BytesIO(b"image-data"),
        len(b"image-data"),
    )

    stubber.add_response(
        "get_object",
        {
            "Body": body,
        },
        {
            "Bucket": "fitmap-private-media",
            "Key": "progress-photos/user/photo",
        },
    )

    with (
        stubber,
        pytest.raises(
            ObjectStorageError,
            match="does not have a content type",
        ),
    ):
        storage.get_object(
            key="progress-photos/user/photo",
        )


def test_delete_object_removes_private_media() -> None:
    storage, stubber = create_s3_storage()

    stubber.add_response(
        "delete_object",
        {},
        {
            "Bucket": "fitmap-private-media",
            "Key": "progress-photos/user/photo",
        },
    )

    with stubber:
        storage.delete_object(
            key="progress-photos/user/photo",
        )
