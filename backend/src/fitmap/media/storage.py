from dataclasses import dataclass
from typing import Protocol
from uuid import UUID, uuid4


@dataclass(frozen=True, slots=True)
class StoredMedia:
    data: bytes
    media_type: str


class ObjectStorageError(Exception):
    pass


class ObjectNotFoundError(ObjectStorageError):
    pass


class PrivateObjectStorage(Protocol):
    def put_object(
        self,
        *,
        key: str,
        data: bytes,
        media_type: str,
    ) -> None: ...

    def get_object(
        self,
        *,
        key: str,
    ) -> StoredMedia: ...

    def delete_object(
        self,
        *,
        key: str,
    ) -> None: ...


def build_progress_photo_storage_key(
    *,
    user_id: UUID,
) -> str:
    object_id = uuid4().hex

    return f"progress-photos/{user_id}/{object_id}"
