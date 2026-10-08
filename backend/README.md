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

Local Python development remains supported. Running the API inside Docker is optional during normal development.

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

Provider configuration may also include:

```text
FITMAP_GEOAPIFY_API_KEY=<provider-key>
FITMAP_GEOAPIFY_TIMEOUT_SECONDS=5.0
```

`.env` files are ignored by Git and excluded from the Docker build context.

Real credentials must never be committed or embedded in container images.

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

Database schema creation is not performed automatically when the API starts.

Schema changes must be managed through explicit Alembic migration steps.

When using the containerized API, migrations can be executed explicitly with:

```bash
docker compose run --rm api alembic upgrade head
```

Inspect the current revision through the container with:

```bash
docker compose run --rm api alembic current
```

Production-oriented application startup must not execute uncontrolled migrations automatically.

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

## Run locally with Python

Start the development API:

```bash
uv run uvicorn fitmap.main:app --host 127.0.0.1 --port 8000 --reload
```

API documentation is available at:

```text
http://127.0.0.1:8000/docs
```

## Run with Docker

Build the backend image from the repository root:

```bash
docker build -t fitmap-backend:local ./backend
```

The production-oriented image:

* uses Python 3.13;
* installs dependencies from `uv.lock`;
* excludes development dependencies;
* runs with a non-root `fitmap` user;
* excludes local `.env` files;
* includes Alembic for explicit migration operations;
* starts the API with Uvicorn.

From the `backend` directory, start PostgreSQL and the containerized API:

```bash
docker compose up -d --build api
```

Check service status:

```bash
docker compose ps
```

The API container is published on port `8000` by default.

The PostgreSQL service is available to the API through the internal Docker network using:

```text
postgres:5432
```

The local host can still access the development PostgreSQL container through the configured host port, normally `5433`.

Stop the API without deleting PostgreSQL data:

```bash
docker compose stop api
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
uv run ruff check src tests alembic
uv run ruff format --check src tests alembic
uv run pyright
uv lock --check
uv run pytest
uv run alembic check
```

To automatically format Python source files:

```bash
uv run ruff format src tests alembic
```

## Container validation

Pull Requests targeting `main` include automated backend-container validation.

The CI workflow verifies that:

* the backend Docker image builds successfully;
* the container is not configured to run as root;
* `.env` is not embedded in the image;
* the production-oriented container can start;
* the `/health` endpoint responds successfully.

The validation workflow is defined at:

```text
.github/workflows/ci.yml
```

## Backend artifacts

Backend images that reach `main` are published as immutable artifacts through GitHub Container Registry.

The publication workflow is defined at:

```text
.github/workflows/backend-image.yml
```

Images are identified using the source commit SHA:

```text
ghcr.io/<repository-owner>/fitmap-backend:sha-<git-sha>
```

Deployment should use immutable SHA-based references instead of relying only on mutable tags such as `latest`.

## Deployment

The current deployment strategy follows ADR 0009.

The intended flow is:

```text
Pull Request
    |
    v
CI validation
    |
    v
main
    |
    v
Immutable backend image
    |
    v
Staging
    |
    v
Production
```

Database migrations remain explicit deployment steps.

Staging and production must use separate runtime configuration and credentials.

The same immutable image validated in staging should be promoted to production rather than rebuilding the application.

A specific staging or production hosting provider has not yet been selected.

Detailed deployment procedures are documented in:

```text
docs/deployment.md
```

## Architecture

The backend follows the FitMap modular-monolith architecture with four primary business modules:

* Identity
* Gyms
* Training
* Progress

PostgreSQL is the primary relational database. SQLAlchemy provides persistence infrastructure and Alembic manages versioned schema changes.

Business-specific models and persistence structures are introduced through their respective backlog items instead of being added prematurely to the persistence foundation.

The deployment and container strategy follows:

```text
docs/architecture/decisions/0009-define-deployment-containers-cicd.md
```