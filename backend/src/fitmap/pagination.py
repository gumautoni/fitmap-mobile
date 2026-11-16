DEFAULT_PAGE_LIMIT = 50
MAX_PAGE_LIMIT = 100


class InvalidPaginationCursorError(ValueError):
    pass


def validate_page_limit(limit: int) -> None:
    if not 1 <= limit <= MAX_PAGE_LIMIT:
        raise ValueError("Page limit is outside the supported range.")
