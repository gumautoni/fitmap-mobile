# ADR 0003 — Use PostgreSQL with SQLAlchemy and Alembic

## Status

Accepted

## Context

FitMap manages strongly related data across users, gyms, workouts, workout sessions and progress records.

The backend requires reliable relational integrity, transactions and controlled schema evolution while keeping persistence concerns separate from API and business logic.

## Decision

FitMap v1 will use:

- PostgreSQL as the primary transactional database;
- SQLAlchemy 2.x for relational persistence;
- Alembic for database schema migrations.

The modular monolith will initially use a single PostgreSQL database.

Each business module retains logical ownership of its data even though the physical database is shared.

Database constraints should reinforce important domain invariants where appropriate through mechanisms such as:

- primary and foreign keys;
- unique constraints;
- non-null constraints;
- check constraints.

Application validation and database integrity complement each other.

### Persistence boundaries

SQLAlchemy is an infrastructure concern and must not define the FitMap domain model.

The application maintains a conceptual distinction between:

```text
API contracts
Domain / application behavior
Persistence models
