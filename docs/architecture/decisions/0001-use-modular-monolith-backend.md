# ADR 0001 — Use a Modular Monolith for the Backend

## Status

Accepted

## Context

FitMap requires backend capabilities for authentication, gym discovery, workout management and progress tracking.

These areas have distinct responsibilities, but the project is currently developed by a small team and has no demonstrated need for independently deployed services.

Adopting microservices at this stage would add network, deployment, observability and data-consistency complexity without proportional benefit.

At the same time, a single deployable backend should not become an application where every feature depends directly on every other feature.

## Decision

FitMap v1 will use a **modular monolith**.

The backend will be deployed as a single application while being organized around four primary business modules:

- `Identity`
- `Gyms`
- `Training`
- `Progress`

### Module responsibilities

**Identity** owns user accounts, profiles, preferences, authentication and sessions.

**Gyms** owns gym discovery, FitMap gym identity, external gym references, favorites and reviews.

**Training** owns exercises, workouts, workout sessions, execution records and training history.

**Progress** owns progress photos, body measurements, fitness goals and progress-oriented capabilities.

Each module owns its business rules and persistence responsibilities.

Cross-module interactions should use explicit application boundaries instead of depending directly on another module's repositories, ORM models or private services.

The modules share a PostgreSQL database initially, but physical database sharing does not remove logical data ownership.

Cross-module foreign keys may be used when they represent legitimate relational integrity without transferring ownership of the referenced entity.

Circular module dependencies should be avoided.

A small shared technical area may exist for genuinely cross-cutting concerns, but it must not become a general location for domain logic.

Internal modules communicate in-process. FitMap will not introduce HTTP communication between modules merely to imitate microservices.

## Consequences

### Positive

- simpler deployment and local development;
- lower operational complexity;
- clear domain ownership;
- straightforward transactional behavior;
- easier testing and debugging;
- future service extraction remains possible if justified.

### Trade-offs

- modules are deployed together;
- independent scaling or deployment by module is not available;
- architectural boundaries require discipline because the database and process are shared.

These trade-offs are appropriate for FitMap v1.

## Alternatives considered

### Unstructured monolith

Rejected because unrestricted coupling between product areas would reduce maintainability as FitMap grows.

### Microservices

Not selected because the current team size, deployment requirements and expected scale do not justify distributed-system complexity.

Microservices may be reconsidered if concrete scaling, availability or organizational requirements eventually require independent services.

## Related documentation

- `../domain-model.md`
- `../high-level-architecture.md`
- `../../requirements/product-scope.md`
