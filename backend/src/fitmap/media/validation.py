from dataclasses import dataclass

SUPPORTED_IMAGE_MEDIA_TYPES = frozenset(
    {
        "image/jpeg",
        "image/png",
        "image/webp",
    }
)

MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024


class InvalidMediaError(ValueError):
    pass


@dataclass(frozen=True, slots=True)
class ValidatedImage:
    data: bytes
    media_type: str


def validate_progress_photo(
    *,
    data: bytes,
    media_type: str,
) -> ValidatedImage:
    normalized_media_type = media_type.strip().lower()

    if normalized_media_type not in SUPPORTED_IMAGE_MEDIA_TYPES:
        raise InvalidMediaError("Unsupported image media type.")

    if not data:
        raise InvalidMediaError("Image file must not be empty.")

    if len(data) > MAX_IMAGE_SIZE_BYTES:
        raise InvalidMediaError("Image file exceeds the maximum allowed size.")

    if not _matches_image_signature(
        data=data,
        media_type=normalized_media_type,
    ):
        raise InvalidMediaError("Image content does not match its media type.")

    return ValidatedImage(
        data=data,
        media_type=normalized_media_type,
    )


def _matches_image_signature(
    *,
    data: bytes,
    media_type: str,
) -> bool:
    if media_type == "image/jpeg":
        return data.startswith(b"\xff\xd8\xff")

    if media_type == "image/png":
        return data.startswith(b"\x89PNG\r\n\x1a\n")

    if media_type == "image/webp":
        return len(data) >= 12 and data.startswith(b"RIFF") and data[8:12] == b"WEBP"

    return False
