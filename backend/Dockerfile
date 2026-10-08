FROM ghcr.io/astral-sh/uv:0.12.18 AS uv

FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    PATH="/app/.venv/bin:$PATH"

WORKDIR /app

COPY --from=uv /uv /uvx /bin/

COPY pyproject.toml uv.lock README.md ./

RUN uv sync --frozen --no-dev --no-install-project

COPY src ./src
COPY alembic ./alembic
COPY alembic.ini ./

RUN uv sync --frozen --no-dev

RUN groupadd --system fitmap \
    && useradd --system --gid fitmap --create-home fitmap

USER fitmap

EXPOSE 8000

CMD ["uvicorn", "fitmap.main:app", "--host", "0.0.0.0", "--port", "8000"]