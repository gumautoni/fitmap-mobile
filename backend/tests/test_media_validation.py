import pytest

from fitmap.media.validation import (
    MAX_IMAGE_SIZE_BYTES,
    InvalidMediaError,
    validate_progress_photo,
)


@pytest.mark.parametrize(
    ("media_type", "data"),
    [
        (
            "image/jpeg",
            b"\xff\xd8\xffexample-jpeg",
        ),
        (
            "image/png",
            b"\x89PNG\r\n\x1a\nexample-png",
        ),
        (
            "image/webp",
            b"RIFF\x04\x00\x00\x00WEBPexample-webp",
        ),
    ],
)
def test_supported_images_are_accepted(
    media_type: str,
    data: bytes,
) -> None:
    validated = validate_progress_photo(
        data=data,
        media_type=media_type,
    )

    assert validated.data == data
    assert validated.media_type == media_type


def test_media_type_is_normalized() -> None:
    validated = validate_progress_photo(
        data=b"\xff\xd8\xffexample-jpeg",
        media_type=" IMAGE/JPEG ",
    )

    assert validated.media_type == "image/jpeg"


def test_unsupported_media_type_is_rejected() -> None:
    with pytest.raises(
        InvalidMediaError,
        match="Unsupported image media type",
    ):
        validate_progress_photo(
            data=b"example",
            media_type="application/pdf",
        )


def test_empty_file_is_rejected() -> None:
    with pytest.raises(
        InvalidMediaError,
        match="must not be empty",
    ):
        validate_progress_photo(
            data=b"",
            media_type="image/jpeg",
        )


def test_file_above_maximum_size_is_rejected() -> None:
    data = b"\xff\xd8\xff" + b"x" * (MAX_IMAGE_SIZE_BYTES - 2)

    with pytest.raises(
        InvalidMediaError,
        match="exceeds the maximum allowed size",
    ):
        validate_progress_photo(
            data=data,
            media_type="image/jpeg",
        )


def test_file_signature_must_match_media_type() -> None:
    with pytest.raises(
        InvalidMediaError,
        match="does not match its media type",
    ):
        validate_progress_photo(
            data=b"\x89PNG\r\n\x1a\nexample-png",
            media_type="image/jpeg",
        )
