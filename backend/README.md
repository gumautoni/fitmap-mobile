
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
- uv 0.13.6
- Docker Desktop with Docker Compose
- PostgreSQL 18, provided through Docker Compose

Node.js, npm and Expo are required for mobile development but are not backend runtime dependencies.

The uv CLI version is aligned between local development,
CI and the Docker image. The `uv_build` backend has its own
version constraints and is maintained independently.

Python virtual environments managed by uv do not require
pip to be installed. Use `uv pip check` when validating
installed dependencies.

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

Nearby discovery and gym details accept optional `provider_name=geoapify|tomtom`. Geoapify is the default when the parameter is omitted. Text-based search uses Geoapify for locality geocoding and may use TomTom for gym discovery when configured.

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

#### Shared location cache (PERF-02)

PERF-02 reduces unnecessary repeated external requests during
text-based gym discovery without changing the public API contract
or gym-search response semantics.

This optimization addresses NFR-PERF-002 and NFR-AVAIL-004
through a bounded, application-owned locality cache.

##### Original behavior

The Geoapify adapter already supported caching locality identifiers
and coordinates with a five-minute time-to-live.

However, the gym-provider dependency created a new provider instance
for every HTTP request. Each provider received its own location cache.

Consequently, equivalent searches issued through separate HTTP
requests repeated the locality geocoding call.

The initial baseline reproduced this behavior:

- five equivalent searches using one provider instance:
  one geocoding call and five Places calls;
- five equivalent HTTP requests using the original dependency:
  five geocoding calls and five Places calls.

##### Cache ownership and architecture

The cache is now initialized by the FastAPI application factory.

Each application instance owns a separate `LocationPlaceIdCache`.

The gym-provider dependency retrieves the application-owned cache
and passes it through the Geoapify provider factory.

The HTTP clients and provider instances continue to follow
their existing request-scoped lifecycle.

Implementation files:

```text
backend/src/fitmap/gyms/cache.py
backend/src/fitmap/gyms/factory.py
backend/src/fitmap/api/gyms.py
backend/src/fitmap/main.py
```

The cache implementation uses Python standard-library components:

- `OrderedDict` for tracking entry recency;
- `Lock` for protecting compound cache operations;
- `monotonic` for expiration measurements independent of
  wall-clock adjustments.

No additional dependency, distributed cache service, database
migration or infrastructure component was introduced.

##### Cache policy

| Property | Implementation |
| --- | --- |
| Ownership | One cache per FastAPI application instance |
| Cached value | Locality place identifier and optional coordinates |
| Key normalization | Strip surrounding whitespace and apply casefold |
| Default TTL | 300 seconds |
| Maximum capacity | 256 entries |
| Eviction | Least recently used |
| Expiration | At or after the original expiration deadline |
| Read behavior | Update recency without extending TTL |
| Persistence | In-memory only |
| Synchronization | Lock-protected cache operations |

The TTL controls whether a cached entry can be returned.

An expired entry is removed when accessed and may also be removed
through capacity-based eviction. There is no background cleanup
scheduler.

The cache is bounded even when locality queries are continually
changing.

A successful read updates the entry's recency but does not renew
its expiration deadline.

Localities without a resolved place identifier and geocoding
failures are not cached.

##### Preserved discovery behavior

For the text-search endpoint:

```text
GET /api/v1/gyms/search
```

A cache hit reuses the locality identifier and coordinates while
the provider continues to request current gym-discovery results.

A cache miss or expired entry triggers the existing Geoapify
geocoding flow.

The optional TomTom discovery flow continues to use the resolved
coordinates and the original discovery radius.

When TomTom is configured, its successful nonempty results retain
their existing precedence. The existing Geoapify fallback and
error-handling behavior remain unchanged.

The optimization does not cache:

- complete gym-search result collections;
- GPS-based nearby-search results;
- gym details;
- location-autocomplete responses;
- favorites, reviews, account data or workout data;
- external provider errors.

Provider credentials are not stored in cache entries.

The cache contains normalized locality queries, so it remains
process-local and nonpersistent. No new cache-content logging
or diagnostic endpoint was introduced.

No public endpoint, response schema or mobile contract was changed.

##### Automated validation

The new regression suite is implemented in:

```text
backend/tests/test_perf02_provider_cache.py
```

It uses real FastAPI application instances and real provider
adapters with `httpx2.MockTransport` responses.

A manual clock verifies expiration boundaries without real
five-minute delays.

The suite covers 11 cases:

1. Reuse across five equivalent HTTP requests.
2. Independent caching of distinct localities.
3. Expiration at the TTL boundary.
4. Isolation between application instances.
5. Missing localities are not cached.
6. Geocoding failures are not cached.
7. Gym-discovery results remain fresh on cache hits.
8. TomTom and Geoapify fallback behavior is preserved.
9. Nearby searches remain uncached.
10. Capacity limits and LRU eviction.
11. Cache reads do not extend the original TTL.

The Red phase produced six expected failures and five passing
tests against the original implementation.

The Green phase passed all 11 new tests and 74 existing tests
covering the related provider and discovery behavior.

##### Controlled comparative benchmark

The benchmark was executed on 2026-11-16 using the original
source from commit `bd9da30c77b084a5559eca805a2f22bb68b3b337`
and the validated PERF-02 implementation.

Both versions were executed in independent Python processes.

The original source was extracted from Git into a temporary
directory, while the optimized version was loaded from the
approved working tree.

The scenarios reused identical synthetic provider responses,
HTTP inputs and controlled clock values.

The primary metric is the number of external provider calls,
rather than elapsed time measured against simulated services.

| Scenario | Geocoding before | Geocoding after | Places before/after | TomTom before/after | Total before | Total after | Total reduction |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 5 equivalent searches | 5 | 1 | 5/5 | 0/0 | 10 | 6 | 40.00% |
| 5 distinct localities | 5 | 5 | 5/5 | 0/0 | 10 | 10 | 0.00% |
| 5 searches in 2 localities | 5 | 2 | 5/5 | 0/0 | 10 | 7 | 30.00% |
| 4 searches across TTL boundary | 4 | 2 | 4/4 | 0/0 | 8 | 6 | 25.00% |
| 3 searches with TomTom fallback | 3 | 1 | 3/3 | 3/3 | 9 | 7 | 22.22% |
| 5 searches with TomTom | 5 | 1 | 5/5 | 5/5 | 15 | 11 | 26.67% |
| 50 equivalent searches | 50 | 1 | 50/50 | 0/0 | 100 | 51 | 49.00% |
| 2 nearby searches | 0 | 0 | 2/2 | 0/0 | 2 | 2 | 0.00% |

For five equivalent searches with TomTom disabled, geocoding
calls decreased by 80% and total external calls decreased by 40%.

For 50 equivalent searches within the TTL, geocoding calls
decreased by 98% and total external calls decreased by 49%.

These reductions apply specifically to the measured scenarios.

All eight scenarios respected their expected call counts.

All 79 HTTP response comparisons matched between the original
and optimized implementations.

The benchmark also verified:

- TTL expiration behavior;
- distinct locality separation;
- the TomTom, Geoapify, TomTom fallback sequence;
- unchanged nearby-search behavior;
- unchanged HTTP client creation counts.

No real external provider request, database query or migration
was required by the benchmark.

The temporary original source directory was removed after
the comparison.

##### Regression evidence

| Check | Result |
| --- | --- |
| Red phase | 5 passed, 6 expected failures |
| Green phase | 85 passed |
| New PERF-02 regression cases | 11 passed |
| Comparative benchmark | 8 scenarios, 79 equivalent HTTP responses |
| Full backend regression | 1,134 passed |
| Ruff lint | Passed |
| Ruff formatting | 193 files correctly formatted |
| Pyright strict | 0 errors, 0 warnings |
| Dependency lockfile | Passed |

The full backend regression includes 1,123 existing test cases
and 11 new PERF-02 test cases.

The local full-suite execution completed in 69.48 seconds.

A pre-existing Starlette/AnyIO deprecation warning was reported.
No test was skipped or suppressed.

The validation was performed on the independent PERF-02 branch.
The PERF-01 regression cases are not included in this count
and must be covered during integrated regression validation.

##### Reproducing automated validation

Run the following commands from the backend directory with the
isolated PostgreSQL test service available:

```bash
uv run pytest tests/test_perf02_provider_cache.py -v
uv run pytest tests/test_gym_provider_cache.py tests/test_geoapify_provider_cache.py tests/test_gym_provider_factory.py tests/test_gym_search_endpoint.py tests/test_gym_text_search_fallback.py tests/test_perf02_provider_cache.py
uv run pytest
uv run ruff check src tests alembic
uv run ruff format --check src tests alembic
uv run pyright
uv lock --check
```

The pytest suite must use the dedicated `fitmap_test` database.

The tests use simulated provider responses and must not be
redirected to live provider credentials for these scenarios.

##### Limitations and follow-up

The cache is local to a FastAPI application instance. It is
not shared across backend worker processes or deployment replicas.

Cache contents are lost when the application instance is restarted.

The lock protects the internal cache structure but is not held
during external network requests.

Concurrent requests for the same uncached locality may still
perform duplicate geocoding calls. In-flight request deduplication
is outside the current implementation.

The capacity and TTL are bounded implementation defaults,
not guarantees of an optimal production cache-hit ratio.

The benchmark demonstrates call-count reduction under controlled
synthetic workloads. It does not establish production latency,
provider availability, billing or quota savings.

Actual benefits depend on search repetition, locality diversity,
request timing, deployment topology and provider configuration.

Further cache expansion, distributed caching or request
deduplication should be justified by representative measurements.


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

## Query performance optimization (PERF-01)

PERF-01 addresses N+1 database access patterns in the favorite-gym
listing and exercise-performance services.

This optimization is associated with the backend performance
requirements and follows a measurement-first approach: reproduce the
problem, establish automated query budgets, implement the optimization,
and verify behavioral equivalence and regression coverage.

### Affected services

| Service | Endpoint |
| --- | --- |
| `list_favorite_gyms` | `GET /api/v1/gyms/favorites` |
| `list_exercise_performance` | `GET /api/v1/progress/exercises/performance` |

Implementation files:

```text
backend/src/fitmap/gyms/favorites.py
backend/src/fitmap/progress/performance.py
```

### Original database access patterns

The original favorite-gym listing queried the user's favorites and then
loaded each gym and its external reference individually.

For N distinct favorite gyms in a fresh ORM session, the measured query
pattern was:

```text
1 + 2N
```

The exercise-performance service queried eligible exercise executions
and their workout sessions, then loaded performed sets separately for
each eligible execution.

The measured query pattern was:

```text
1 + N
```

Here, N represents eligible exercise executions in the benchmark.

The repeated SQL round trips caused query counts to increase with
collection size, even when the requested result was relatively small.

### Optimized database access patterns

Favorite gyms are now loaded through three bounded batch queries:

1. Retrieve the authenticated user's favorite relationships.
2. Retrieve the associated gym records in a single batch.
3. Retrieve the associated external references in a single batch.

The resulting models are indexed by their identifiers in memory.

The earliest external reference remains the selected reference for each
gym, ordered by creation timestamp and UUID as a deterministic
tie-breaker.

The favorite response construction is shared between the collection
and single-favorite flows.

Exercise performance now uses two batch queries:

1. Retrieve eligible exercise executions and completed workout sessions.
2. Retrieve performed sets associated with those execution identifiers.

Performed sets are grouped by execution identifier before the existing
performance aggregation is applied.

Both services return immediately when their initial collection is empty,
avoiding unnecessary secondary queries.

### Behavioral guarantees

The optimization preserves:

- authenticated user isolation;
- existing service signatures and API response contracts;
- favorite ordering by creation timestamp and UUID;
- earliest external-reference selection and deterministic tie-breaking;
- existing errors for missing gym records or external references;
- single-favorite loading behavior;
- chronological exercise-performance ordering;
- aggregation of repeated exercise executions in the same session;
- performed-set counts and total repetitions;
- independent maximum-load calculations for kilograms and pounds;
- exclusion of active and cancelled workout sessions;
- exclusion of exercise executions without a catalog exercise reference;
- exclusion of executions without performed sets;
- the requirement for at least two recorded workout sessions before
  exposing an exercise-performance series.

No API contract, database schema, migration, dependency or mobile
application change was required.

### Automated query budgets

The regression suite is implemented in:

```text
backend/tests/test_perf01_query_budgets.py
```

It uses a real isolated PostgreSQL database, synthetic records,
transaction rollback and SQLAlchemy statement events.

SQL statements are captured only during the domain-service invocation.
Fixture preparation, authentication and transaction setup are excluded
from the service query budget.

Fresh ORM sessions prevent identity-map reuse from hiding the original
N+1 behavior.

The following limits are verified:

| Collection size | Favorite gyms | Exercise performance |
| ---: | ---: | ---: |
| 0 | 1 | 1 |
| 1 | 3 | 2 |
| 10 | 3 | 2 |
| 50 | 3 | 2 |
| 100 | 3 | 2 |

The suite contains 15 test cases:

- five parameterized favorite-gym query-budget cases;
- five parameterized exercise-performance query-budget cases;
- three favorite-gym behavioral regression cases;
- two exercise-performance behavioral regression cases.

The Red phase reproduced six expected query-budget failures with
nine passing cases. All behavioral tests passed.

The Green phase passed all 15 new cases and all 13 original
favorite-gym and exercise-performance tests.

### Controlled benchmark

The comparative benchmark was executed on 2026-11-16 using:

- Python 3.13.18;
- SQLAlchemy 2.0.54;
- PostgreSQL 18 in the isolated local test environment;
- original implementations from commit `bd9da30c77b084a5559eca805a2f22bb68b3b337`;
- optimized implementations from the validated PERF-01 working tree.

Each scenario used identical synthetic records for both implementations.

Each implementation received one warm-up invocation followed by five
measured invocations. Execution order was alternated to reduce ordering
bias, and every invocation used a fresh ORM session.

The reported execution times are medians in milliseconds.

#### Favorite-gym listing

| Records | SQL before | SQL after | Before (ms) | After (ms) | SQL reduction |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 0 | 1 | 1 | 1.30 | 1.08 | 0.00% |
| 1 | 3 | 3 | 10.14 | 7.19 | 0.00% |
| 10 | 21 | 3 | 15.86 | 2.80 | 85.71% |
| 50 | 101 | 3 | 75.50 | 5.38 | 97.03% |
| 100 | 201 | 3 | 151.53 | 6.31 | 98.51% |

At 100 records, the query count decreased from 201 to 3, with a
median service execution time approximately 24 times lower.

#### Exercise performance

| Executions | SQL before | SQL after | Before (ms) | After (ms) | SQL reduction |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 0 | 1 | 1 | 1.31 | 1.30 | 0.00% |
| 1 | 2 | 2 | 3.56 | 3.39 | 0.00% |
| 10 | 11 | 2 | 8.79 | 2.36 | 81.82% |
| 50 | 51 | 2 | 37.76 | 3.86 | 96.08% |
| 100 | 101 | 2 | 88.20 | 6.38 | 98.02% |

At 100 executions, the query count decreased from 101 to 2, with a
median service execution time approximately 13.8 times lower.

All 50 measured comparisons returned equivalent service responses.
All five collection sizes respected their expected query budgets.

Synthetic transactions were rolled back, and no synthetic records
remained in the eight affected database tables.

### Validation evidence

The following checks passed after the optimization:

| Check | Result |
| --- | --- |
| Red phase | 9 passed, 6 expected failures |
| Green phase | 28 passed |
| Comparative benchmark | 50 equivalent response comparisons |
| Full backend regression | 1,138 passed |
| Ruff lint | Passed |
| Ruff formatting | 193 files correctly formatted |
| Pyright strict | 0 errors, 0 warnings |
| Dependency lockfile | Passed |

The full backend regression includes 1,123 previous test cases and
15 new PERF-01 cases.

The local full-suite execution completed in 79.20 seconds.

A pre-existing Starlette/AnyIO deprecation warning was reported.
No new dependency, migration or test suppression was introduced.

### Reproducing the automated validation

Run the following commands from the backend directory with the
isolated PostgreSQL test service available:

```bash
uv run pytest tests/test_perf01_query_budgets.py -v
uv run pytest tests/test_perf01_query_budgets.py tests/test_gym_favorites.py tests/test_progress_performance.py
uv run pytest
uv run ruff check src tests alembic
uv run ruff format --check src tests alembic
uv run pyright
uv lock --check
```

These commands must use the dedicated `fitmap_test` database.
Do not redirect the regression suite to the development or production
database.

### Measurement limitations and follow-up

The benchmark measures local domain-service execution, not full HTTP
request latency, mobile rendering time or concurrent production load.

Execution-time improvements are environment-dependent and must not be
interpreted as production latency guarantees.

The measured query counts remain bounded for the evaluated collection
sizes. The number of loaded rows, SQL parameters and in-memory
aggregation costs still depend on collection size.

Large collections may require additional pagination, bounded batches,
or database-side aggregation based on further measurements.

PERF-03 will evaluate pagination for the targeted historical
collections without silently truncating existing application behavior.

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
