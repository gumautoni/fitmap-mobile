# Architecture Decision Records

This directory contains the Architecture Decision Records (ADRs) for FitMap.

ADRs document technical decisions that have meaningful architectural consequences and are useful to preserve over time.

## Current decisions

| ADR | Decision | Status |
| --- | --- | --- |
| [0001](0001-use-modular-monolith-backend.md) | Use a modular monolith for the backend | Accepted |
| [0002](0002-use-python-fastapi-backend.md) | Use Python and FastAPI for the backend | Accepted |
| [0003](0003-use-postgresql-primary-database.md) | Use PostgreSQL with SQLAlchemy and Alembic | Accepted |
| [0004](0004-keep-react-native-expo-migrate-typescript.md) | Keep React Native and Expo and migrate to TypeScript | Accepted |
| [0005](0005-use-backend-managed-authentication-rotating-sessions.md) | Use backend-managed authentication and rotating sessions | Accepted |
| [0006](0006-isolate-external-location-gym-providers.md) | Isolate external location and gym providers | Accepted |
| [0007](0007-store-private-media-object-storage.md) | Store private media in object storage | Accepted |
| [0008](0008-define-rest-api-design-versioning.md) | Define REST API design and versioning | Accepted |
| [0009](0009-define-deployment-containers-cicd.md) | Define deployment, containers and CI/CD strategy | Accepted |

## Naming convention

ADR files follow this pattern:

`NNNN-short-decision-title.md`

Numbers are sequential and should not be reused after an ADR has been merged into the main branch.

## Status

An ADR may use one of the following statuses:

- Proposed
- Accepted
- Deprecated
- Superseded

Once an accepted ADR has been merged into the main branch, a change to the architectural decision should normally be documented through a new ADR rather than silently rewriting the existing record.

Editorial corrections that do not change the decision may still be made when necessary.
