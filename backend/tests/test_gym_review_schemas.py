from datetime import UTC, datetime
from decimal import Decimal
from types import SimpleNamespace
from uuid import uuid4

import pytest
from pydantic import ValidationError

from fitmap.gyms.review_schemas import (
    GymRatingSummaryResponse,
    GymReviewCreateRequest,
    GymReviewListResponse,
    GymReviewReportCreateRequest,
    GymReviewReportReason,
    GymReviewReportResponse,
    GymReviewResponse,
    GymReviewUpdateRequest,
)


@pytest.mark.parametrize("rating", [1, 2, 3, 4, 5])
def test_create_accepts_supported_ratings(rating: int) -> None:
    payload = GymReviewCreateRequest.model_validate({"rating": rating})

    assert payload.rating == rating
    assert payload.comment is None


@pytest.mark.parametrize(
    "rating",
    [0, -1, 6, 3.5, "4", True, None],
)
def test_create_rejects_invalid_ratings(rating: object) -> None:
    with pytest.raises(ValidationError):
        GymReviewCreateRequest.model_validate({"rating": rating})


def test_create_normalizes_comment() -> None:
    payload = GymReviewCreateRequest.model_validate(
        {
            "rating": 5,
            "comment": "  Academia bem equipada.  ",
        }
    )

    assert payload.comment == "Academia bem equipada."


def test_create_accepts_comment_at_length_limit() -> None:
    payload = GymReviewCreateRequest.model_validate(
        {
            "rating": 4,
            "comment": "a" * 1000,
        }
    )

    assert payload.comment == "a" * 1000


@pytest.mark.parametrize(
    "comment",
    ["", " ", "\n\t", "a" * 1001],
)
def test_create_rejects_invalid_comments(
    comment: str,
) -> None:
    with pytest.raises(ValidationError):
        GymReviewCreateRequest.model_validate(
            {
                "rating": 4,
                "comment": comment,
            }
        )


def test_create_rejects_client_supplied_ownership() -> None:
    with pytest.raises(ValidationError):
        GymReviewCreateRequest.model_validate(
            {
                "rating": 5,
                "user_id": str(uuid4()),
            }
        )


def test_create_requires_rating() -> None:
    with pytest.raises(ValidationError):
        GymReviewCreateRequest.model_validate({"comment": "Muito boa."})


def test_update_accepts_rating_only() -> None:
    payload = GymReviewUpdateRequest.model_validate({"rating": 3})

    assert payload.model_fields_set == {"rating"}
    assert payload.rating == 3


def test_update_accepts_comment_only() -> None:
    payload = GymReviewUpdateRequest.model_validate({"comment": "  Atendimento excelente.  "})

    assert payload.model_fields_set == {"comment"}
    assert payload.comment == "Atendimento excelente."


def test_update_accepts_both_fields() -> None:
    payload = GymReviewUpdateRequest.model_validate(
        {
            "rating": 4,
            "comment": "Bom ambiente.",
        }
    )

    assert payload.model_fields_set == {
        "rating",
        "comment",
    }


def test_update_allows_explicit_comment_removal() -> None:
    payload = GymReviewUpdateRequest.model_validate({"comment": None})

    assert payload.model_fields_set == {"comment"}
    assert payload.comment is None


def test_update_rejects_empty_payload() -> None:
    with pytest.raises(ValidationError):
        GymReviewUpdateRequest.model_validate({})


@pytest.mark.parametrize(
    "rating",
    [0, 6, 4.5, "4", True, None],
)
def test_update_rejects_invalid_ratings(
    rating: object,
) -> None:
    with pytest.raises(ValidationError):
        GymReviewUpdateRequest.model_validate({"rating": rating})


@pytest.mark.parametrize(
    "comment",
    ["", " \t ", "a" * 1001],
)
def test_update_rejects_invalid_comments(
    comment: str,
) -> None:
    with pytest.raises(ValidationError):
        GymReviewUpdateRequest.model_validate({"comment": comment})


def test_update_rejects_client_supplied_user_id() -> None:
    with pytest.raises(ValidationError):
        GymReviewUpdateRequest.model_validate(
            {
                "rating": 4,
                "user_id": str(uuid4()),
            }
        )


@pytest.mark.parametrize(
    "reason",
    ["spam", "offensive", "misleading", "other"],
)
def test_report_accepts_supported_reasons(
    reason: str,
) -> None:
    payload = GymReviewReportCreateRequest.model_validate({"reason": reason})

    assert payload.reason == GymReviewReportReason(reason)
    assert payload.details is None


def test_report_normalizes_details() -> None:
    payload = GymReviewReportCreateRequest.model_validate(
        {
            "reason": "misleading",
            "details": "  Informacoes incorretas.  ",
        }
    )

    assert payload.details == "Informacoes incorretas."


def test_report_accepts_details_at_length_limit() -> None:
    payload = GymReviewReportCreateRequest.model_validate(
        {
            "reason": "other",
            "details": "a" * 500,
        }
    )

    assert payload.details == "a" * 500


@pytest.mark.parametrize(
    "details",
    ["", "  \n ", "a" * 501],
)
def test_report_rejects_invalid_details(
    details: str,
) -> None:
    with pytest.raises(ValidationError):
        GymReviewReportCreateRequest.model_validate(
            {
                "reason": "spam",
                "details": details,
            }
        )


@pytest.mark.parametrize(
    "reason",
    ["unknown", "", None, 10],
)
def test_report_rejects_invalid_reason(
    reason: object,
) -> None:
    with pytest.raises(ValidationError):
        GymReviewReportCreateRequest.model_validate({"reason": reason})


def test_report_rejects_client_supplied_reporter() -> None:
    with pytest.raises(ValidationError):
        GymReviewReportCreateRequest.model_validate(
            {
                "reason": "spam",
                "reporter_user_id": str(uuid4()),
            }
        )


def test_review_response_serializes_orm_data() -> None:
    review_id = uuid4()
    gym_id = uuid4()
    timestamp = datetime(2026, 10, 23, 15, 0, tzinfo=UTC)

    record = SimpleNamespace(
        id=review_id,
        user_id=uuid4(),
        gym_id=gym_id,
        rating=5,
        comment="Boa academia.",
        created_at=timestamp,
        updated_at=timestamp,
        removed_at=None,
    )

    response = GymReviewResponse.model_validate(record)
    data = response.model_dump(mode="json")

    assert data["id"] == str(review_id)
    assert data["gym_id"] == str(gym_id)
    assert data["rating"] == 5
    assert data["comment"] == "Boa academia."
    assert "user_id" not in data
    assert "removed_at" not in data


def test_rating_summary_serializes_average() -> None:
    gym_id = uuid4()

    response = GymRatingSummaryResponse(
        gym_id=gym_id,
        average_rating=Decimal("4.50"),
        review_count=2,
    )

    data = response.model_dump(mode="json")

    assert data["gym_id"] == str(gym_id)
    assert data["average_rating"] == "4.50"
    assert data["review_count"] == 2


def test_rating_summary_accepts_no_reviews() -> None:
    response = GymRatingSummaryResponse(
        gym_id=uuid4(),
        average_rating=None,
        review_count=0,
    )

    assert response.average_rating is None
    assert response.review_count == 0


def test_rating_summary_rejects_negative_count() -> None:
    with pytest.raises(ValidationError):
        GymRatingSummaryResponse.model_validate(
            {
                "gym_id": str(uuid4()),
                "average_rating": None,
                "review_count": -1,
            }
        )


def test_review_list_response_groups_reviews() -> None:
    gym_id = uuid4()
    now = datetime(2026, 10, 23, 15, 0, tzinfo=UTC)

    response = GymReviewListResponse(
        summary=GymRatingSummaryResponse(
            gym_id=gym_id,
            average_rating=Decimal("5.00"),
            review_count=1,
        ),
        reviews=[
            GymReviewResponse(
                id=uuid4(),
                gym_id=gym_id,
                rating=5,
                comment=None,
                created_at=now,
                updated_at=now,
            )
        ],
    )

    assert len(response.reviews) == 1
    assert response.summary.review_count == 1


def test_report_response_serializes_orm_data() -> None:
    report_id = uuid4()
    review_id = uuid4()
    now = datetime(2026, 10, 23, 15, 0, tzinfo=UTC)

    record = SimpleNamespace(
        id=report_id,
        review_id=review_id,
        reporter_user_id=uuid4(),
        reason="spam",
        details="Conteudo repetitivo.",
        created_at=now,
    )

    response = GymReviewReportResponse.model_validate(record)
    data = response.model_dump(mode="json")

    assert data["id"] == str(report_id)
    assert data["review_id"] == str(review_id)
    assert data["reason"] == "spam"
    assert "reporter_user_id" not in data
    assert "details" not in data
