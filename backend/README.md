
# FitMap Backend

Backend API for the FitMap mobile fitness platform.

The backend is built with Python 3.13 and FastAPI, following a modular-monolith architecture. It provides authenticated REST endpoints, PostgreSQL persistence, gym discovery and favorites, workout management, training history, progress tracking, private media storage and automated testing.

FitMap is developed as a Software Engineering final-year project (TCC) and is under active development.

## Architecture

The backend is organized into four primary business modules:

- **Identity:** user accounts, authentication, sessions and profile preferences.
- **Gyms:** external gym discovery, gym details, persistent gym identity and user favorites.
- **Training:** exercise catalog, workout planning, workout sessions, execution records and history.
- **Progress:** workout statistics, exercise performance and private progress photos.

The backend follows a modular-monolith architecture, maintaining separation between business modules, API routing, persistence and external integrations.

The mobile application communicates with the backend through the versioned REST API:

`/api/v1`

PostgreSQL is the primary relational database. SQLAlchemy provides persistence infrastructure, while Alembic manages versioned schema migrations.

External integrations are isolated from core business logic.

## Requirements

- Python 3.13
- uv
- Docker Desktop with Docker Compose
- PostgreSQL 18, provided through Docker Compose

Node.js, npm and Expo are required for mobile development but are not backend runtime dependencies.

## Setup

From the `backend` directory:

```bash
uv sync
```

The Python virtual environment is managed locally in `.venv/` and must not be committed.

Local Python development is supported. Running the FastAPI application inside Docker is optional during normal development.

## Environment configuration

When configuring a new environment, create the local environment file from the committed example.

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Do not overwrite an existing configured `.env`.

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

Authentication requires a backend-managed JWT secret.

Gym discovery uses a server-side Geoapify integration:

```text
FITMAP_GEOAPIFY_API_KEY=<provider-key>
FITMAP_GEOAPIFY_TIMEOUT_SECONDS=5.0
```

Private media storage uses S3-compatible configuration:

```text
FITMAP_MEDIA_BUCKET_NAME=<private-bucket-name>
FITMAP_MEDIA_REGION_NAME=us-east-1
FITMAP_MEDIA_ENDPOINT_URL=http://127.0.0.1:9090
FITMAP_MEDIA_ACCESS_KEY_ID=<local-access-key>
FITMAP_MEDIA_SECRET_ACCESS_KEY=<local-secret-key>
```

The media endpoint above is appropriate when the backend runs directly on the development machine and S3Mock is published on port `9090`.

When the backend runs inside Docker Compose, the media endpoint uses the internal service address instead.

The actual local values must be configured according to the environment.

### Security rules

- `.env` files must never be committed.
- Real credentials must not be embedded in container images.
- Backend secrets must not be exposed through the mobile application.
- Provider credentials remain exclusively in backend configuration.
- Authentication and resource ownership are enforced server-side.

## PostgreSQL

Start the local development database:

```bash
docker compose up -d postgres
```

Check its status:

```bash
docker compose ps
```

The PostgreSQL service is ready when its health status is `healthy`.

The development database is normally exposed on:

```text
127.0.0.1:5433
```

Stop only the PostgreSQL service when appropriate:

```bash
docker compose stop postgres
```

Start an existing stopped service:

```bash
docker compose start postgres
```

The development database uses a persistent Docker volume.

Do not remove the PostgreSQL volume as part of routine development, troubleshooting or test execution.

## Database migrations

FitMap uses Alembic for explicit, versioned database schema migrations.

Apply pending migrations:

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

Show the migration head:

```bash
uv run alembic heads
```

Check whether SQLAlchemy metadata contains schema changes not represented by migrations:

```bash
uv run alembic check
```

Create a migration after an intentional model change:

```bash
uv run alembic revision --autogenerate -m "describe schema change"
```

Generated migrations must be reviewed before being applied.

Database schema creation is not performed automatically when the API starts.

Production-oriented application startup must not execute uncontrolled migrations.

### Persistent gym identity

The Gyms module introduces the following persisted entities:

- `Gym`
- `GymExternalReference`
- `FavoriteGym`

Their relationships are:

```text
User
  |
  +-- FavoriteGym
          |
          +-- Gym
                |
                +-- GymExternalReference
```

`Gym.id` is the internal, stable identity managed by FitMap.

External provider identifiers are maintained through `GymExternalReference` and must not replace the internal gym identity.

The favorites persistence structure enforces:

- one favorite relationship per user and gym;
- ownership through the authenticated user;
- unique external references per provider;
- preservation of the gym record when a favorite is removed.

Gym favorites were introduced through Alembic migration:

```text
24f94d668735_add_gym_favorites.py
```

## Database sessions and transactions

SQLAlchemy uses a shared engine and a session factory.

The persistence layer owns session creation and cleanup. Business operations are responsible for explicit transaction boundaries.

The transaction policy is:

- one database session per operation or request scope;
- infrastructure-managed session creation and cleanup;
- explicit commits for successful writes;
- rollback when operations fail;
- no direct database engine creation inside HTTP handlers.

This prevents accidental partial commits and keeps business transactions predictable.

## Run locally with Python

Start the development API:

```bash
uv run uvicorn fitmap.main:app --host 127.0.0.1 --port 8000 --reload
```

When a physical mobile device needs to communicate with the backend through the local network, use:

```bash
uv run uvicorn fitmap.main:app --host 0.0.0.0 --port 8000 --reload
```

The development computer and mobile device must have network connectivity that permits access to the backend.

Useful local URLs:

```text
http://127.0.0.1:8000/health
http://127.0.0.1:8000/ready
http://127.0.0.1:8000/docs
```

The mobile application uses its local `EXPO_PUBLIC_API_URL` configuration to communicate with the REST API.

## Implemented API capabilities

The following capabilities are implemented in the backend.

### Identity

The Identity module provides:

- user registration;
- authentication and credential validation;
- secure password hashing with Argon2;
- JWT access tokens;
- refresh-token rotation;
- persisted authentication sessions;
- logout and session revocation;
- authenticated identity resolution;
- private profile retrieval and updates.

Authentication endpoints under `/api/v1`:

```text
POST /auth/register
POST /auth/login
POST /auth/refresh
GET  /auth/me
POST /auth/logout
```

Profile endpoints:

```text
GET   /profile
PATCH /profile
```

Private user ownership is determined by the authenticated backend identity, not by arbitrary user identifiers supplied by the mobile client.

### Gyms

The Gyms module provides:

- search by textual location;
- nearby gym discovery using coordinates;
- gym details retrieved from an external provider;
- provider abstraction;
- internal persistent gym identity;
- external provider references;
- authenticated gym favorites.

Gym discovery endpoints:

```text
GET /gyms/search
GET /gyms/nearby
GET /gyms/{external_id}
```

Favorite gym endpoints:

```text
GET    /gyms/favorites
POST   /gyms/{external_id}/favorite
DELETE /gyms/favorites/{gym_id}
```

The POST endpoint accepts the provider's external gym identifier.

The backend resolves this external identity into a persistent internal `Gym` record.

The DELETE endpoint accepts the internal FitMap gym UUID.

Favorite operations enforce:

- authenticated access;
- ownership isolation;
- prevention of duplicate favorites;
- consistent provider-reference resolution;
- preservation of the internal gym record after unfavoriting.

The mobile application integrates these endpoints with the map, gym results and gym-details screen.

The gym rating and review functionality remains planned and is not part of the current implemented API.

### Training

The Training module provides:

- global exercise catalog;
- user-owned custom exercises;
- workout creation and configuration;
- exercise ordering;
- workout archiving and restoration;
- workout session lifecycle;
- actual performed-set recording;
- repetitions and load recording;
- active-session resumption;
- session completion and cancellation;
- completed workout history.

Workout plans are separate from actual workout execution.

Completed sessions preserve historical execution information even when the source workout is later modified.

Private workout information is restricted to the authenticated user.

### Progress

The Progress module provides:

- basic training statistics;
- exercise performance history;
- private progress-photo metadata;
- authenticated progress-photo upload;
- private progress-photo retrieval;
- ownership isolation.

Progress endpoints under `/api/v1`:

```text
GET  /progress/statistics
GET  /progress/exercises/performance

POST /progress/photos
GET  /progress/photos
GET  /progress/photos/{progress_photo_id}/content
```

#### Basic training statistics

Statistics are derived from completed workout-session data.

The current API provides:

- total completed workouts;
- completed workouts in the last seven days;
- completed workouts in the last thirty days;
- distinct training days in the last thirty days;
- total performed sets associated with completed workouts.

#### Exercise performance

The exercise-performance endpoint returns historical data derived from completed training sessions.

Available information includes:

- exercise identity and name;
- chronological performance points;
- associated completed workout session;
- number of performed sets;
- total repetitions;
- maximum recorded loads by supported load unit.

These values are derived from recorded training execution rather than manually fabricated progress indicators.

#### Private progress photos

Progress-photo functionality includes:

- authenticated JPEG, PNG and WebP uploads;
- maximum file size of 10 MiB;
- media-type validation;
- file-signature validation;
- private object storage;
- persistent PostgreSQL metadata;
- recording date;
- optional workout-session association;
- private listing and content retrieval;
- user ownership enforcement.

A progress photo does not require a workout-session association.

When an associated workout session is deleted, the photo record can remain available through a nullable relationship using `SET NULL`.

Image binaries are stored separately from PostgreSQL.

Body-measurement tracking and expanded measurable fitness goals remain future work.

## Private media storage

FitMap uses an S3-compatible private object-storage abstraction.

The implementation separates:

- media validation;
- storage configuration;
- object-storage operations;
- progress-photo business rules;
- PostgreSQL metadata persistence.

### Local development with S3Mock

The local development environment uses Adobe S3Mock.

Start PostgreSQL and S3Mock:

```bash
docker compose up -d postgres s3mock
```

Check their status:

```bash
docker compose ps
```

S3Mock is normally exposed through:

```text
http://127.0.0.1:9090
```

The object-storage service uses a dedicated persistent Docker volume configured to retain files.

The backend communicates with storage through its S3-compatible abstraction, avoiding direct coupling between progress-photo business logic and a specific development storage service.

The current S3Mock environment is intended for local development. It must not be presented as a production storage deployment.

## Run with Docker

Build the backend image from the repository root:

```bash
docker build -t fitmap-backend:local ./backend
```

The production-oriented backend image:

- uses Python 3.13;
- installs locked dependencies;
- excludes development dependencies;
- runs with a non-root application user;
- excludes local `.env` files;
- includes Alembic for explicit migrations;
- starts the API through Uvicorn.

From the `backend` directory, start the containerized API and its dependencies:

```bash
docker compose up -d --build api
```

Check status:

```bash
docker compose ps
```

The API is published on port `8000` by default.

When running through Docker Compose, PostgreSQL and S3Mock are accessed through their internal service addresses:

```text
postgres:5432
http://s3mock:9090
```

Do not run a separate host Uvicorn server on the same published API port simultaneously.

Database migrations remain explicit.

For containerized execution:

```bash
docker compose run --rm api alembic upgrade head
```

Inspect the revision:

```bash
docker compose run --rm api alembic current
```

Stop the containerized API when appropriate:

```bash
docker compose stop api
```

Do not remove database or private-media volumes as part of routine application development.

## System endpoints

```text
GET /health
GET /ready
```

`/health` confirms that the API process is running.

`/ready` verifies connectivity with PostgreSQL and returns `503 Service Unavailable` when the database dependency is unavailable.

## Automated testing

The backend uses pytest, FastAPI TestClient and a dedicated PostgreSQL test environment.

### Isolated PostgreSQL test database

The test database is defined in:

```text
backend/compose.test.yaml
```

Its configuration uses:

```text
Database: fitmap_test
Host: 127.0.0.1
Port: 5434
Service: postgres-test
```

The test database is separate from the development database on port `5433`.

It uses temporary storage and must never be substituted with the real development or production database.

From the `backend` directory, start the test service:

```bash
docker compose -f compose.test.yaml up -d --wait postgres-test
```

Confirm its status:

```bash
docker compose -f compose.test.yaml ps
```

Then execute:

```bash
uv run pytest
```

The pytest fixtures prepare the isolated test database using Alembic migrations.

Tests must never be redirected to a database containing valuable application data.

### Test coverage areas

The automated backend suite validates behavior across:

- authentication and session management;
- user profile persistence;
- user isolation and authorization;
- database integration and migrations;
- external gym-provider integration;
- gym identity and favorite relationships;
- workout planning and configuration;
- workout execution;
- training-session lifecycle;
- historical training integrity;
- progress statistics;
- exercise performance;
- private progress-photo operations;
- media validation and storage;
- system endpoints and API error behavior.

## Quality checks

Run these commands from the `backend` directory:

```bash
uv run pytest
uv run ruff check src tests alembic
uv run ruff format --check src tests alembic
uv run pyright
uv lock --check
uv run alembic check
```

These checks verify:

- automated test behavior;
- Python lint rules;
- code formatting;
- static type consistency;
- dependency lockfile consistency;
- migration and SQLAlchemy metadata alignment.

Automatic formatting, when intentionally required, may be performed with:

```bash
uv run ruff format src tests alembic
```

The complete testing strategy is documented in:

```text
../docs/testing.md
```

## Continuous Integration

Pull Requests targeting `main` are validated through GitHub Actions.

The backend workflow includes:

- Python environment preparation;
- locked dependency installation;
- Ruff linting;
- Ruff formatting checks;
- Pyright;
- pytest with PostgreSQL.

Mobile validation runs separately and includes Jest, TypeScript, ESLint and Prettier.

Backend container validation checks:

- successful Docker image construction;
- non-root execution;
- exclusion of `.env` from the image;
- production-oriented container startup;
- successful `/health` response.

The CI workflow is defined at:

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

Deployment must favor immutable SHA-based references rather than relying exclusively on mutable tags such as `latest`.

## Deployment

The current deployment strategy follows ADR 0009.

The intended delivery flow is:

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

The documented delivery flow is an architectural direction and must not be interpreted as confirmation that staging or production deployment is currently operational.

Detailed deployment procedures are available in:

```text
../docs/deployment.md
```

## Technical documentation

The project maintains architectural and implementation documentation under `docs/` at the repository root.

Relevant references:

- [High-level architecture](../docs/architecture/high-level-architecture.md)
- [Domain model](../docs/architecture/domain-model.md)
- [Architecture decisions](../docs/architecture/decisions/README.md)
- [Testing strategy](../docs/testing.md)
- [Deployment](../docs/deployment.md)
- [Mobile development](../docs/mobile-development.md)
- [Main project README](../README.md)

## Current development status

The backend currently includes implemented capabilities across Identity, Gyms, Training and Progress.

The favorite gyms functionality has passed automated backend and mobile tests and functional validation on a physical iPhone.

The favorite gyms feature remains on its development branch until the Pull Request is reviewed, CI succeeds and the changes are merged into `main`.

Planned capabilities, including body-metric history, expanded fitness goals and gym ratings/reviews, remain separate from the implemented functionality.

Documentation should always distinguish actual implementation from approved architecture and future backlog items.
