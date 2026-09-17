# ADR 0004 — Use SQLAlchemy and Alembic for Relational Persistence

## Status

Accepted

## Context

FitMap v1 uses PostgreSQL as its primary transactional database and Python with FastAPI for the backend API.

The persistence layer must support:

- relational data modeling;
- transactional operations;
- explicit constraints;
- maintainable queries;
- schema evolution;
- automated testing;
- modular backend boundaries;
- separation between transport, business rules and infrastructure.

The persistence strategy must not cause SQLAlchemy models to become the entire application model.

FitMap also needs a migration process that keeps local, test and production database schemas reproducible and version-controlled.

At the same time, the architecture should avoid unnecessary abstraction layers that merely wrap the ORM without protecting meaningful application or domain boundaries.

## Decision

FitMap v1 will use **SQLAlchemy 2.x** as the primary relational persistence toolkit for the Python backend.

FitMap will use **Alembic** to manage version-controlled PostgreSQL schema migrations.

The persistence architecture will maintain explicit conceptual separation between:

- API transport schemas;
- application and domain behavior;
- persistence models.

These representations may share similar structures where appropriate, but they must not be treated as automatically interchangeable.

Conceptually:

```text
HTTP / API schemas
        |
        v
Application use cases
        |
        v
Domain behavior
        |
        v
Persistence boundary
        |
        v
SQLAlchemy
        |
        v
PostgreSQL