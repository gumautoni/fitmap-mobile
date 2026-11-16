
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

Authentication requires a backend-managed JWT secret and an
independent HMAC rate-limit secret.

### JWT signing secret

`FITMAP_AUTH_JWT_SECRET` is required for all backend environments.

FitMap uses HS256 and validates the signing secret when loading
application settings. The policy requires:

- at least 32 UTF-8 bytes;
- no whitespace or control characters;
- no recognized example placeholders or complete repeated patterns;
- independence from configured rate-limit, password-recovery,
  email-verification and outbox encryption secrets;
- no recognized test-only signing secrets outside the test environment.

Invalid configuration prevents normal application startup.

Generate a new signing secret with a cryptographically secure random
generator. For example, from the backend directory:

```bash
uv run python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Run this command privately and transfer its output directly to your
protected environment configuration or secret manager.

The command generates 48 random bytes encoded as a URL-safe string.
Never share its output in messages, screenshots, logs or Git commits.

Length and weak-pattern checks do not prove cryptographic entropy.
Always generate new signing secrets using a secure random generator.

Use separate secrets for development, staging and production.
Keep the signing secret persistent and consistent across workers
within the same environment.

Do not regenerate an existing valid signing secret during normal startup.
Changing it invalidates previously issued access tokens.
Coordinate any rotation with the authentication and session lifecycle.

Validation errors hide input values in their normal textual representation.
Do not log raw validation-error payloads or environment configuration.

The CI container smoke test generates independent ephemeral secrets
for JWT signing and rate limiting and masks them in workflow logs.
These values are not deployment credentials.

### Authentication rate limiting

Configure `FITMAP_AUTH_RATE_LIMIT_SECRET` with a cryptographically random
value of at least 32 bytes. Do not reuse JWT, recovery, verification or
outbox encryption secrets. Never use example placeholders.

Login and registration fail closed with HTTP 503 when rate limiting
cannot operate safely.

| Action | Per IP | Per email |
| --- | --- | --- |
| Login | 30 per 15 minutes | 5 per 15 minutes |
| Registration | 10 per hour | 3 per hour |

Requests exceeding either limit return HTTP 429 with `Retry-After`.
Counters are persisted before authentication, including denied attempts.

Use a persistent secret shared by API workers in the same environment.
When deploying behind a reverse proxy, configure trusted proxy addresses
explicitly. Never trust arbitrary forwarded IP headers.

Schedule periodic maintenance to prune expired rate-limit buckets.
Application-level limits complement, but do not replace, ingress-level
abuse protection and monitoring.

### Account enumeration resistance

Authentication failures use a uniform HTTP 401 response with the
`invalid_credentials` error code for unknown accounts, incorrect passwords
and inactive accounts.

Unknown accounts are processed using a dummy password hash generated
with the same password hashing policy used for registered accounts.
The dummy hash is initialized during application construction and
cached within the process.

This avoids an additional password-hashing operation during the first
request involving an unknown account. It does not guarantee identical
response times or eliminate every timing side channel.

Login and registration rate limits apply independently of account
existence and complement the generic authentication failure responses.

#### Registration contract and residual risk

Successful registration returns HTTP 201 and issues an authenticated
session. Duplicate registration returns HTTP 409 with the
`account_already_exists` error code.

This behavior is intentionally preserved for compatibility with the
current mobile application and its immediate-registration flow.

The distinction between successful registration and duplicate registration
allows account existence to be inferred. Rate limiting reduces abuse
but does not eliminate this enumeration channel.

Before public commercial distribution, review the registration workflow
and evaluate an email-ownership verification flow that avoids exposing
account existence before ownership is established.

#### Password recovery and email verification

Password recovery requests use a uniform HTTP 202 response for known,
unknown, ineligible and rate-limited account identities when the feature
is available.

Internal database and outbox operations may still introduce observable
timing differences.

Password recovery and email verification remain disabled by default.
Review timing side channels, abuse controls and operational email
delivery before enabling these features in a deployed environment.

### Authentication response caching

The authentication route group uses a centralized ASGI middleware
that sets `Cache-Control: no-store` on responses produced within its
middleware chain.

The policy covers successful authentication responses and handled
errors, including registration, login, token refresh, account identity,
logout, password recovery and email verification.

The middleware respects the configured API prefix and does not modify
unrelated route groups. Existing HTTP status codes, response bodies
and rate-limit headers remain unchanged.

The directive instructs compliant HTTP caches not to store these
responses. It does not replace HTTPS, secure client-side token storage
or operational privacy controls.

Unhandled errors generated outside the middleware chain and responses
produced by external proxies require separate validation.

Validate the deployed proxy configuration and any ASGI root-path
configuration before production distribution.

Gym discovery uses server-side provider adapters. Geoapify supports text search and nearby discovery, while TomTom provides an optional nearby-discovery and details integration:

```text
FITMAP_GEOAPIFY_API_KEY=<provider-key>
FITMAP_GEOAPIFY_TIMEOUT_SECONDS=5.0

FITMAP_TOMTOM_API_KEY=<tomtom-provider-key>
FITMAP_TOMTOM_TIMEOUT_SECONDS=10.0
```

The TomTom key is optional. When TomTom is not configured, an explicit TomTom request is unavailable; the mobile nearby-discovery service can retry with Geoapify. Provider keys must never be placed in mobile environment variables or committed to Git.

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

### Secret management and repository scanning

Real credentials must remain outside tracked source files, examples,
container images and documentation.

Backend credentials include database passwords, JWT signing secrets,
authentication rate-limit secrets, password-recovery and email-verification
secrets, email-provider keys, outbox encryption keys, gym-provider API keys
and private media-storage credentials.

Use independent credentials for each environment and security purpose.
Example values and local S3Mock defaults must never be used as production
credentials.

The repository uses Gitleaks with default rules and a FitMap-specific
environment credential rule. Reviewed exceptions are restricted by file,
variable and matched value rather than excluding entire files or test
directories.

The scanner validates both the proposed snapshot and commits introduced
by a Pull Request. This includes credentials committed and removed before
the final revision.

Scanner reports are temporary. CI emits finding counts instead of
credential values or raw reports.

For local validation of a clean checked-out revision, run the repository
scanner with explicit full base and head commit hashes:

```text
python scripts/security/scan_secrets.py --base BASE_SHA --head HEAD_SHA
```

Run this command from the repository root with Python 3.13 and Docker
available. Replace the arguments with actual commit hashes.

A successful scan returns exit code 0. Detected findings return exit
code 42. Scanner or validation failures return a nonzero exit code.

Do not publish raw scanner reports or credential values.

If a real credential is discovered, treat it as potentially compromised.
Revoke or rotate it through its provider, assess its usage and exposure,
and determine whether coordinated history remediation is necessary.

Deleting a credential from the latest revision does not invalidate it
or remove it from Git history.

See the repository README for the SEC-05 audit scope and residual risks.

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
POST /auth/logout/refresh
```


#### Session revocation and refresh concurrency

The existing `POST /api/v1/auth/logout` endpoint requires a valid
bearer access token and revokes its associated session.

The additional endpoint `POST /api/v1/auth/logout/refresh`
accepts a JSON body containing `refresh_token` and does not
require a valid access token.

Its behavior is:

- resolve the session from the hash of the presented refresh token;
- revoke the associated session and its refresh-token family;
- preserve other sessions belonging to the same account;
- return HTTP 204 for known, unknown or previously revoked tokens
  when the payload is valid and processing succeeds;
- return HTTP 422 for invalid payloads;
- never issue replacement credentials.

A previously consumed refresh token remains usable for revocation
only. It cannot authorize protected requests or obtain replacement
credentials.

The authentication no-store middleware covers the new endpoint.
A uniform HTTP response does not imply constant-time processing
or immunity to all timing side channels.

Rotation and revocation use the same session-first lock order:

1. Resolve the session association through the refresh-token hash.
2. Acquire a PostgreSQL row lock on the authentication session.
3. Re-read the refresh token after obtaining the session lock,
   when performing a rotation.
4. Validate the latest persisted session and token state.
5. Rotate or revoke credentials within the current transaction.

Locked ORM queries refresh existing identity-map state to avoid
making decisions from stale objects.

The SEC-06 regression suite reproduced PostgreSQL deadlock
SQLSTATE `40P01` before this correction and verified the corrected
behavior with controlled concurrent transactions.

Concurrent replay of a consumed refresh token revokes the entire
session, including any replacement credentials.

The regression tests cover the investigated lock orderings.
They do not establish that every future database operation is
free of deadlocks.

No schema migration was required for this change.

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

Nearby discovery and gym details accept optional `provider_name=geoapify|tomtom`. Geoapify is the default when the parameter is omitted. Text-based search remains Geoapify-only.

Favorite gym endpoints:

```text
GET    /gyms/favorites
POST   /gyms/{external_id}/favorite
POST   /gyms/{external_id}/identity
DELETE /gyms/favorites/{gym_id}
```

Favorite creation and identity resolution accept the same optional provider selector. Favorite deletion uses the persistent internal FitMap gym UUID.

The POST endpoint accepts the provider's external gym identifier.

The backend resolves this external identity into a persistent internal `Gym` record.

The DELETE endpoint accepts the internal FitMap gym UUID.

Favorite operations enforce:

- authenticated access;
- ownership isolation;
- prevention of duplicate favorites;
- consistent provider-reference resolution;
- preservation of the internal gym record after unfavoriting.

The mobile application preserves provider identity across search results, map selection, details, favorites and reviews. Its nearby-discovery flow requests TomTom first and falls back to Geoapify for empty or recoverable failure responses.

Gym ratings and reviews are implemented through separate endpoints using the persistent internal FitMap gym UUID, resolved from a provider-aware external identity.

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
GET  /progress/photos/page
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

## Bounded history and progress collections (PERF-03)

PERF-03 addresses NFR-PERF-003 and follows the measurement-first
approach defined by NFR-PERF-006.

Large workout-history and progress-photo collections support
cursor-based pagination. Existing clients retain access to the
original unpaginated endpoints.

### API contract

Authenticated endpoints under `/api/v1`:

| Collection | Paginated endpoint | Legacy endpoint |
| --- | --- | --- |
| Completed workouts | `GET /training/history/page` | `GET /training/history` |
| Progress photos | `GET /progress/photos/page` | `GET /progress/photos` |

Both paginated endpoints accept:

- `limit`: defaults to 50; valid range is 1 through 100;
- `cursor`: optional UUID identifying the previous page's last item.

The response envelope is:

```json
{
  "items": [],
  "next_cursor": null
}
```

The items retain the existing collection DTOs.
A non-null `next_cursor` indicates that another page is available.
A null cursor indicates that the collection traversal is complete.

The workout-history endpoint additionally accepts:

- `completed_from`: inclusive lower timestamp boundary;
- `completed_before`: exclusive upper timestamp boundary.

These values must contain timezone information.
When both are provided, the lower boundary must precede the
upper boundary.

Example request for a calendar month in UTC-03:00:

```text
GET /api/v1/training/history/page?limit=50&completed_from=2026-11-01T03:00:00Z&completed_before=2026-12-01T03:00:00Z
```

Invalid query parameters receive HTTP 422 with the existing
`request_validation_error` contract.

A malformed, unknown, foreign-owned or otherwise ineligible
pagination cursor receives HTTP 422 with
`invalid_pagination_cursor`.

A cursor must identify an item in the requested collection,
including the applicable owner, status and date-range conditions.
Cursor errors do not disclose another user's records.

Both paginated responses use `Cache-Control: private, no-store`.
Progress-photo metadata does not expose private storage keys.
Image binaries continue to use the authenticated content endpoint.

### Query strategy and ordering

Pagination uses keyset comparisons rather than OFFSET.

Workout history is ordered by:

1. `completed_at DESC`;
2. `started_at DESC`;
3. `id DESC`.

Only completed sessions with a completion timestamp are eligible.

Progress photos are ordered by:

1. `recorded_at DESC`;
2. `id DESC`.

The unique identifier provides a deterministic tie-breaker.

An initial request uses a single collection query.
A subsequent request resolves the cursor anchor before retrieving
the next page.

The collection query fetches at most `limit + 1` rows to determine
whether another page exists. There is no additional COUNT query.

Ownership and the requested date boundaries are enforced in the
database queries.

### PostgreSQL indexes

Alembic revision:

```text
f03a7b2c9d81
```

Parent revision: `d36a1f5e29b0`.

The migration adds two non-unique indexes:

- `ix_workout_sessions_user_completed_order`;
- `ix_progress_photos_user_recorded_order`.

The workout-history index covers:

```text
user_id, completed_at DESC, started_at DESC, id DESC
```

Its partial predicate is:

```sql
status = 'completed' AND completed_at IS NOT NULL
```

The progress-photo index covers:

```text
user_id, recorded_at DESC, id DESC
```

SQLAlchemy metadata declares the same indexes.
Existing indexes are retained.

Upgrade, downgrade and re-upgrade were validated on isolated
PostgreSQL infrastructure. Alembic metadata alignment was verified.

The migration was also applied to the local development database
for physical validation without modifying the existing records.

### Paired collection benchmark

The benchmark used synthetic records and real backend handlers.
The measurements compare the legacy full response with the first
page of the corresponding collection.

JSON sizes are serialized response sizes in bytes.
Handler times are local medians from five repeated measurements.
They exclude real mobile-network latency and image binary retrieval.

| Collection | Records | Legacy bytes | Page bytes | Legacy ms | Page ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| History | 0 | 2 | 31 | 1.198 | 1.440 |
| History | 50 | 14091 | 14120 | 1.576 | 1.699 |
| History | 250 | 70641 | 14214 | 3.877 | 1.594 |
| History | 1000 | 282891 | 14214 | 10.907 | 2.154 |
| Photos | 0 | 2 | 31 | 0.911 | 0.958 |
| Photos | 50 | 8901 | 8930 | 1.926 | 1.461 |
| Photos | 250 | 44501 | 8964 | 2.964 | 1.391 |
| Photos | 1000 | 178001 | 8964 | 10.291 | 2.161 |

For 1,000 records, the initial response size decreases by
approximately 94.98% for workout history and 94.96% for photos.

The page envelope adds a small overhead for empty and small
collections. Traversing every page can transfer slightly more
total JSON than the original unpaginated response.

The benchmark confirmed 40 equivalent first-page comparisons and
8 complete traversals across the tested collection sizes.

At 1,000 records, complete traversal requires 20 pages and
39 collection/anchor queries. The optimization targets bounded
initial and incremental loading, not fewer queries when the entire
collection is explicitly requested.

### Index experiment

A separate PostgreSQL experiment used temporary tables,
synthetic data, fresh planner statistics and
`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)`.

The experiment compared equivalent queries with and without the
candidate indexes. The original public tables and indexes were
preserved.

Selected results for users with 10,000 records:

| Scenario | Before ms | After ms | Before buffers | After buffers |
| --- | ---: | ---: | ---: | ---: |
| History: first page | 2.761 | 0.036 | 201 | 3 |
| History: deep page | 0.886 | 0.058 | 204 | 10 |
| History: bounded range | 0.664 | 0.031 | 201 | 3 |
| Photos: first page | 2.328 | 0.043 | 274 | 7 |
| Photos: deep page | 0.809 | 0.057 | 277 | 8 |

Times represent combined local anchor/page execution medians.
Buffers represent combined shared and local buffer accesses.

The candidate ordered indexes were selected without forcing the
planner, and the tested page queries no longer required a sort.

Ten equivalent query-result comparisons were confirmed.

These SQL measurements are separate from the paired handler
benchmark. They are not production latency measurements.

### Automated validation

The implementation adds 31 backend tests in:

```text
tests/test_perf03_pagination.py
```

Coverage includes:

- legacy contract compatibility;
- authentication and ownership isolation;
- default and maximum page sizes;
- empty collections and complete traversal;
- stable ordering and timestamp ties;
- cursor validation and cross-collection rejection;
- insertion of newer records between page requests;
- inclusive and exclusive date boundaries;
- cursor eligibility within the requested range.

The targeted backend regression passed 55 tests.

The complete PERF-03 branch regression passed:

- 1,123 existing backend tests;
- 31 new backend tests;
- 1,154 backend tests in total;
- 675 mobile tests;
- 1,829 automated tests across both applications.

The backend tests used the isolated PostgreSQL database on port
5434. The regression reported the known Starlette/AnyIO
deprecation warning.

Ruff lint, Ruff formatting, Pyright and lockfile validation passed.
Local Windows Pyright execution required explicit selection of
the backend virtual-environment interpreter. No typing rules
or dependency configuration were changed.

### Physical validation and cleanup

On November 16, 2026, the developer confirmed all 17 physical
validation scenarios on an iPhone using Expo Go and the local API.

A dedicated synthetic account contained 65 completed workout
records and 55 valid synthetic PNG images in private local
object storage. One additional image was uploaded through the
mobile application.

The account, its 65 workout records and all 56 associated
image objects were removed after validation.

The original development user, five workout-session records
and three progress photos were preserved.
The contents of the original private images were verified.
The migration and both pagination indexes remain applied.

### Limitations and operational considerations

- Legacy collection endpoints remain unbounded for compatibility.
- Cursor traversal does not provide a historical database snapshot.
- Concurrent changes or deleted anchors may require a restart.
- Clients must not interpret an incomplete page traversal as a
  complete collection.
- Cursor pagination does not reduce the size of individual image
  binaries.
- The mobile calendar traverses the entire visible date range
  before presenting complete activity summaries.
- The mobile history can still request the full legacy collection
  when filters require complete results.
- Indexes introduce storage and write-maintenance overhead.
- Planner behavior depends on data distribution, statistics and
  execution context, including generic prepared plans.
- These measurements do not establish a production latency SLA.
- The indexes are created using the regular Alembic migration
  strategy. Production deployment must account for index-build
  locking and table size.

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
- refresh-token-based logout and token-family revocation;
- concurrent rotation, logout and replay detection;
- stale ORM authentication-state regression tests;
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
