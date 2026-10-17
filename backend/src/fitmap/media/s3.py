from botocore.exceptions import BotoCoreError, ClientError
from mypy_boto3_s3 import S3Client

from fitmap.media.storage import (
    ObjectNotFoundError,
    ObjectStorageError,
    StoredMedia,
)


class S3PrivateObjectStorage:
    def __init__(
        self,
        *,
        client: S3Client,
        bucket_name: str,
    ) -> None:
        self._client = client
        self._bucket_name = bucket_name

    def put_object(
        self,
        *,
        key: str,
        data: bytes,
        media_type: str,
    ) -> None:
        try:
            self._client.put_object(
                Bucket=self._bucket_name,
                Key=key,
                Body=data,
                ContentType=media_type,
            )
        except (BotoCoreError, ClientError) as exc:
            raise ObjectStorageError("Unable to store private media.") from exc

    def get_object(
        self,
        *,
        key: str,
    ) -> StoredMedia:
        try:
            response = self._client.get_object(
                Bucket=self._bucket_name,
                Key=key,
            )
        except ClientError as exc:
            error_code = exc.response.get("Error", {}).get("Code")

            if error_code in {"404", "NoSuchKey", "NotFound"}:
                raise ObjectNotFoundError("Private media was not found.") from exc

            raise ObjectStorageError("Unable to retrieve private media.") from exc
        except BotoCoreError as exc:
            raise ObjectStorageError("Unable to retrieve private media.") from exc

        try:
            data = response["Body"].read()
        except (BotoCoreError, OSError) as exc:
            raise ObjectStorageError("Unable to read private media.") from exc

        media_type = response.get("ContentType")

        if not media_type:
            raise ObjectStorageError("Stored media does not have a content type.")

        return StoredMedia(
            data=data,
            media_type=media_type,
        )

    def delete_object(
        self,
        *,
        key: str,
    ) -> None:
        try:
            self._client.delete_object(
                Bucket=self._bucket_name,
                Key=key,
            )
        except (BotoCoreError, ClientError) as exc:
            raise ObjectStorageError("Unable to delete private media.") from exc
