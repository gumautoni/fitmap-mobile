# FitMap Backend Deployment

This document describes the current FitMap backend packaging and deployment foundation.

The current implementation provides a reproducible container image, local Docker Compose integration, immutable backend artifacts published to GitHub Container Registry, and a defined staging-before-production promotion flow.

FitMap does not currently define a production hosting provider. The deployment foundation is intentionally provider-neutral until a concrete hosting decision is required.

## Deployment principles

The backend deployment strategy follows ADR 0009.

The current principles are:

- package the FastAPI backend as a Docker image;
- keep runtime configuration outside the image;
- keep credentials and secrets outside source control;
- identify backend artifacts using immutable source revisions;
- validate changes before they reach `main`;
- build deployable artifacts from `main`;
- validate an artifact in staging before promoting the same artifact to production;
- execute database migrations explicitly;
- never run uncontrolled schema migrations automatically during application startup;
- keep production promotion intentional and controllable;
- avoid Kubernetes and additional orchestration until operational needs justify them.

## Backend image

The backend image is defined by `backend/Dockerfile`.

The image:

- uses Python 3.13;
- installs dependencies from the committed `uv.lock`;
- excludes development dependencies;
- runs the API using a non-root `fitmap` user;
- does not contain local `.env` files;
- includes Alembic so migrations can be executed explicitly;
- starts the application using Uvicorn.

The application startup command is:

`python -m fitmap.server --host 0.0.0.0 --port 8000`

Application startup does not execute database migrations.

## Local container build

From the repository root:

```bash
docker build -t fitmap-backend:local ./backend
```

The image can be inspected to verify that the application process is not configured to run as root:

```bash
docker run --rm fitmap-backend:local id
```

Local environment files must not be present inside the image.

## Local integration with Docker Compose

The development Compose configuration is located at `backend/compose.yaml`.

From the `backend` directory:

```bash
docker compose up -d --build api
```

This starts:

- PostgreSQL;
- the FitMap backend API.

The API waits for PostgreSQL to become healthy before starting.

Check the services with:

```bash
docker compose ps
```

The API health endpoint is:

`GET http://127.0.0.1:8000/health`

The readiness endpoint is:

`GET http://127.0.0.1:8000/ready`

`/health` verifies that the API process is running.

`/ready` verifies that the API can connect to PostgreSQL.

Local Python development remains supported and does not require running the API inside Docker.

## Runtime configuration

Runtime settings are provided externally through environment variables.

The container image must not contain environment-specific credentials or secrets.

Examples of backend configuration include:

```text
FITMAP_ENVIRONMENT
FITMAP_LOG_LEVEL

FITMAP_DB_HOST
FITMAP_DB_PORT
FITMAP_DB_NAME
FITMAP_DB_USER
FITMAP_DB_PASSWORD

FITMAP_GEOAPIFY_API_KEY
FITMAP_GEOAPIFY_TIMEOUT_SECONDS
```

Local development may use `backend/.env`.

That file is ignored by Git and excluded from the Docker build context.

Staging and production environments must provide their own configuration through the selected hosting platform or secret-management mechanism.

Production credentials must never be committed to the repository or embedded in a Docker image.

## Operational logging (OBS-01)

Start the API through `python -m fitmap.server` to apply the
supported logging configuration.

The container entrypoint uses this command by default.

Set `FITMAP_LOG_LEVEL=INFO` to retain request-level operational
events. Higher severity thresholds suppress lower-level events.

Logs are emitted as JSON records to standard output.

Use the response `X-Request-ID` to correlate API requests
with their corresponding `http_request` events.

Conventional Uvicorn access logs are disabled because raw
request URLs can contain sensitive information.

Unexpected exceptions remain errors, while the configured
operational formatter omits raw messages and tracebacks.

The API does not automatically configure external monitoring,
log retention, alerting or centralized log collection.

Future hosting infrastructure must restrict access to logs
and independently review proxy and platform logging settings.

## Database migrations

Database migrations are explicit deployment operations.

The backend must not automatically execute `alembic upgrade head` during normal application startup.

### Local migration with uv

From the `backend` directory:

```bash
uv run alembic upgrade head
```

### Migration using the container image

When the API image and PostgreSQL are available through Docker Compose:

```bash
docker compose run --rm api alembic upgrade head
```

The current database revision can be inspected with:

```bash
docker compose run --rm api alembic current
```

For a hosted environment, the equivalent migration command must be executed as a controlled deployment step using the same backend image that will be deployed.

A migration failure must stop the deployment process rather than being silently ignored.

## Pull Request validation

Pull Requests targeting `main` are validated by `.github/workflows/ci.yml`.

The CI workflow validates:

- mobile tests;
- mobile TypeScript;
- mobile linting and formatting;
- backend dependency lock consistency;
- backend Ruff linting;
- backend Ruff formatting;
- backend Pyright;
- backend automated tests;
- backend Docker image build;
- non-root container execution;
- exclusion of `.env` from the image;
- backend container startup;
- backend `/health` response;
- backend `/ready` response with a real PostgreSQL instance;
- readiness HTTP 503 during database unavailability;
- readiness recovery after PostgreSQL restarts.

The container smoke test uses an isolated Docker network,
ephemeral credentials and temporary PostgreSQL storage.
The backend remains running during the simulated outage.
Readiness validates connectivity, not schema completeness
or all external dependencies.

A production-oriented backend artifact should only originate from code that has passed the required Pull Request validation.

## Immutable backend artifacts

Backend images are published by `.github/workflows/backend-image.yml`.

The workflow runs when backend-related changes reach `main`.

Images are published to GitHub Container Registry using the source commit SHA.

The artifact format is:

`ghcr.io/<repository-owner>/fitmap-backend:sha-<git-sha>`

Example:

`ghcr.io/gumautoni/fitmap-backend:sha-0123456789abcdef...`

The SHA-based image reference makes the artifact traceable to the exact source revision used to build it.

Deployment procedures must prefer immutable SHA references rather than relying only on mutable tags such as `latest`.

## Staging and production flow

The intended backend delivery flow is:

```text
Pull Request
    |
    v
CI validation
    |
    v
Merge to main
    |
    v
Build immutable backend image
    |
    v
Staging
    |
    v
Explicit database migration
    |
    v
Application deployment
    |
    v
Health and readiness validation
    |
    v
Production approval
    |
    v
Promote the same immutable image
    |
    v
Explicit production migration
    |
    v
Production deployment
    |
    v
Health and readiness validation
```

Staging and production must use separate runtime configuration and credentials.

The image validated in staging should be the same immutable image promoted to production. Production promotion must not rebuild the application from a different source revision.

## Staging validation

Before production promotion, staging should verify at minimum:

- the intended immutable image reference is deployed;
- required runtime configuration is available;
- database migrations complete successfully;
- `/health` returns success;
- `/ready` returns success;
- expected API behavior is functional;
- no production credentials are being used in staging.

If staging validation fails, the artifact must not be promoted to production.

## Production promotion

Production promotion should be an intentional action.

Where supported by the selected hosting platform or GitHub deployment workflow, manual approval should be used before production promotion.

Production deployment should:

1. identify the exact immutable image already validated in staging;
2. provide production-specific runtime configuration;
3. execute required database migrations explicitly;
4. deploy the same image;
5. verify `/health`;
6. verify `/ready`;
7. perform appropriate functional validation.

Production promotion must not depend on a local developer workstation.

## Rollback

The immutable image strategy allows a previously known backend artifact to be identified again by its SHA-based reference.

Application rollback and database rollback are separate concerns.

An application image may be rolled back to a previous known artifact when compatible with the current database schema.

Database downgrades must never be performed automatically. They require an explicit migration decision because schema rollback may involve data-loss risks.

## Mobile releases

The backend container workflow does not package or deploy the mobile application.

Mobile release responsibilities remain separate and compatible with the approved React Native and Expo architecture.

### Mobile release foundation (INFRA-05)

The repository defines EAS development, preview and production
profiles in `eas.json`, independently of backend deployment.

| Profile | Distribution | Android |
|---|---|---|
| development | Internal development client | APK |
| preview | Internal release build | APK |
| production | App store release | AAB |

Development continues through Expo Go. The development-client
profile requires installing a compatible `expo-dev-client`
before its first native build.

The Node.js baseline follows INFRA-04. Build versions are
managed locally in `app.json`, with explicit versionCode
and buildNumber values. Increase them intentionally before
subsequent store releases.

Before initiating a remote build:

1. Confirm ownership of the existing Android and iOS identifiers.
2. Link the repository to the intended Expo project.
3. Configure the corresponding EAS environment.
4. Provide a reachable HTTPS API URL for release builds.
5. Configure restricted Android Maps SDK credentials.
6. Configure platform signing and distribution credentials.
7. Use a clean Git checkout.

`EXPO_PUBLIC_API_URL` is public client configuration, not a secret.
Preview and production must use an actual HTTPS backend.
No production API URL is currently committed.

The Android Maps SDK key is read dynamically by `app.config.ts`
from `GOOGLE_MAPS_ANDROID_API_KEY`. Restrict it to the Android
package, signing certificate SHA-1 and Maps SDK for Android.
It is embedded in the native application and is not a server secret.

The iOS application retains its default Apple Maps provider.

The EAS upload exclusions preserve Git exclusions and additionally
exclude the backend, documentation and local environment files.
Configure build environment variables through Expo Services
instead of uploading local dotenv files.

After prerequisites are satisfied, supported commands include:

```bash
eas build --platform android --profile preview
eas build --platform android --profile production
eas build --platform ios --profile preview
eas build --platform ios --profile production
```

These commands require an authenticated, compatible EAS CLI.
iOS physical-device distribution requires appropriate Apple
signing credentials and provisioning.

No remote Expo project, signing credentials, native build,
store submission or mobile production deployment was created
as part of INFRA-05.

Expo Go validation does not replace native build validation.

## Current infrastructure scope

The current FitMap deployment foundation intentionally does not require:

- Kubernetes;
- Terraform;
- service meshes;
- multi-region infrastructure;
- autoscaling infrastructure;
- microservice orchestration.

Those technologies should only be introduced when concrete operational requirements justify their additional complexity.

## Current limitation

FitMap currently defines the deployment process and produces deployable backend artifacts, but no specific staging or production hosting provider has been selected.

When a hosting provider is introduced, environment-specific deployment commands and secret-management procedures should be added to this document without changing the architecture principles defined above.