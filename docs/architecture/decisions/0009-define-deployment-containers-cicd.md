# ADR 0009 — Define Deployment, Containers and CI/CD Strategy

## Status

Accepted

## Context

FitMap needs a reproducible way to run, validate and deploy its backend while keeping the operational architecture proportional to the project's current scale.

The deployment strategy must support local development, automated validation, staging and production without introducing infrastructure that is not yet justified.

## Decision

FitMap will:

- package the backend as a Docker image;
- use Docker Compose for local integration with PostgreSQL and other required infrastructure;
- use GitHub Actions for continuous integration and, progressively, deployment automation;
- produce versioned and immutable backend deployment artifacts;
- use staging as the validation environment before production;
- execute database migrations as an explicit deployment step;
- keep environment configuration and secrets outside container images;
- use the Expo/EAS-compatible workflow for mobile builds and releases.

Developers are not required to run the backend inside Docker during everyday development. A local Python `.venv` may be used while infrastructure such as PostgreSQL runs through containers.

## CI

Pull requests will progressively validate:

- backend linting, formatting, typing and tests;
- database migrations;
- mobile linting, formatting, typing and tests.

Required branch-protection checks will only be enabled after the corresponding CI jobs are stable.

## Deployment

Backend images should be traceable to a specific source revision or release rather than relying only on mutable tags such as `latest`.

The preferred deployment flow is conceptually:

```text
Pull Request
    |
    v
CI
    |
    v
main
    |
    v
Build immutable artifact
    |
    v
Staging
    |
    v
Production
