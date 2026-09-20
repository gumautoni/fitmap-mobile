# FitMap Backend

Backend API for the FitMap mobile fitness platform.

## Requirements

* Python 3.13
* uv
* Docker Desktop with Docker Compose

## Setup

From the `backend` directory:

```bash
uv sync
```

The project virtual environment is managed locally in `.venv/` and must not be committed.

## Environment configuration

Create the local environment file from the committed example.

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

The local development configuration includes:

```text
FITMAP_ENVIRONMENT=development
FITMAP_LOG_LEVEL=INFO

FITMAP_DB_HOST=127.0.0.1
FITMAP_DB_PORT=5433
FITMAP_DB_NAME=fitmap
FITMAP_DB_USER=fitmap
FITMAP_DB_PASSWORD=<local-password>
```

`.env` files are ignored by Git. Real credentials must never be committed.

The local PostgreSQL container listens on port `5432` internally and is published on port `5433` by default.

## PostgreSQL

Start the local database:

```bash
docker compose up -d postgres
```

Check its status:

```bash
docker compose ps
```

The service is ready when its health status is `healthy`.

Stop the database:

```bash
docker compose stop postgres
```

Start an existing stopped database:

```bash
docker compose start postgres
```

Stop and remove the Compose containers and network while preserving database data:

```bash
docker compose down
```

To also remove the local database volume:

```bash
docker compose down -v
```

> `docker compose down -v` permanently deletes the local PostgreSQL data stored in the Compose volume.

## Database migrations

FitMap uses Alembic for versioned database schema migrations.

Apply all migrations:

```bash
uv run alembic upgrade head
```

Show the currently applied revision:

```bash
uv run alembic current
```

Show migration history:

```bash
uv run alembic history
```

Show the current migration head:

```bash
uv run alembic heads
```

Check whether the SQLAlchemy metadata contains schema changes not represented by migrations:

```bash
uv run alembic check
```

Create a migration after intentional model changes:

```bash
uv run alembic revision --autogenerate -m "describe schema change"
```

Database schema creation is not performed automatically when the API starts. Schema changes must be managed through Alembic migrations.

## Database sessions and transactions

SQLAlchemy uses a shared engine and a session factory.

The persistence layer owns session creation and cleanup. Business operations are responsible for deciding when a transaction should be committed.

The transaction policy is:

* one database session per application operation/request scope;
* the persistence infrastructure opens and closes the session;
* successful writes are committed explicitly by the application/use-case layer;
* exceptions trigger rollback;
* HTTP handlers do not create database engines or manage connection infrastructure directly.

This keeps transaction boundaries explicit and prevents partial business operations from being committed automatically.

## Run

Start the development API:

```bash
uv run uvicorn fitmap.main:app --host 127.0.0.1 --port 8000 --reload
```

API documentation is available at:

```text
http://127.0.0.1:8000/docs
```

## System endpoints

```text
GET /health
GET /ready
```

`/health` confirms that the API process is running.

`/ready` verifies that the API can connect to PostgreSQL. It returns `503 Service Unavailable` when the database dependency is unavailable.

## Quality checks

```bash
uv run ruff check src alembic
uv run ruff format --check src alembic
uv run pyright src
uv lock --check
uv run alembic check
```

To automatically format Python source files:

```bash
uv run ruff format src alembic
```

## Architecture

The backend follows the FitMap modular-monolith architecture with four primary business modules:

* Identity
* Gyms
* Training
* Progress

PostgreSQL is the primary relational database. SQLAlchemy provides persistence infrastructure and Alembic manages versioned schema changes.

Business-specific models and persistence structures are introduced through their respective backlog items instead of being added prematurely to the persistence foundation.
