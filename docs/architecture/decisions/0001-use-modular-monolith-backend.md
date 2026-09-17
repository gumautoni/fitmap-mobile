# ADR 0001 — Use a Modular Monolith for the FitMap Backend

## Status

Accepted

## Context

FitMap v1 requires backend capabilities for multiple product domains, including:

- identity and user profile;
- gym discovery and persistent gym relationships;
- training planning and execution;
- progress tracking;
- media-related metadata;
- authentication and authorization.

These domains have different responsibilities and should remain clearly separated.

However, FitMap is currently being developed by a small team, has no demonstrated requirement for independently deployed backend services, and does not currently have scalability or organizational constraints that justify a distributed microservices architecture.

Introducing microservices at this stage would add operational and development complexity such as:

- multiple deployable services;
- service-to-service communication;
- distributed failure handling;
- independent service authentication;
- distributed tracing;
- contract versioning;
- additional infrastructure;
- more complex local development;
- more complex CI/CD;
- distributed transaction and consistency concerns.

This complexity would not currently provide proportional product or engineering value.

At the same time, using a single backend application must not result in an unstructured monolith where domain responsibilities are freely mixed.

## Decision

FitMap v1 will use a **modular monolith backend architecture**.

The backend will be deployed as a single application while maintaining explicit internal module boundaries aligned with the primary FitMap domains.

The initial domain-oriented backend boundaries are expected to include concepts such as:

- Identity and Profile;
- Gym Discovery;
- Training;
- Progress.

Cross-cutting infrastructure concerns such as persistence, configuration, logging and external-service integration must support these modules without unnecessarily coupling their domain logic.

Modules should communicate through well-defined application boundaries and should not depend directly on another module's internal implementation unless explicitly justified.

A shared physical database may be used while preserving clear logical ownership of domain data.

The architecture must not assume that every module should become a future microservice.

## Consequences

### Positive consequences

The selected architecture:

- keeps deployment and local development comparatively simple;
- reduces distributed-system complexity;
- supports transactional consistency where appropriate;
- allows the development team to understand and operate the complete backend;
- preserves explicit domain boundaries;
- supports automated testing with lower infrastructure overhead;
- allows the system to scale vertically or through multiple application instances when appropriate;
- provides a foundation from which individual services could later be extracted if justified by real requirements.

### Trade-offs

The selected architecture also means:

- backend modules are deployed together;
- independent deployment of individual modules is not available;
- careless implementation could still create excessive coupling between modules;
- module boundaries must therefore be actively protected through architecture, code organization and review.

These trade-offs are acceptable for FitMap v1.

## Alternatives considered

### Unstructured monolith

Rejected because placing unrelated domain behavior together without explicit boundaries would reduce maintainability, testability and future architectural flexibility.

### Microservices

Not selected for FitMap v1.

Microservices may provide independent deployment, scaling and team ownership benefits, but FitMap does not currently have requirements that justify the additional distributed-system and operational complexity.

## Reconsideration criteria

This decision may be revisited if concrete evidence demonstrates that one or more modules require independent deployment or scaling.

Examples may include:

- a module develops substantially different scaling characteristics;
- independent release cycles become operationally necessary;
- team growth creates clear independent ownership boundaries;
- isolation requirements cannot be reasonably satisfied within the modular monolith;
- availability requirements justify independent service operation;
- measured operational constraints show that extraction provides meaningful value.

Microservices must not be introduced solely because the product has grown or because distributed architecture is perceived as more advanced.

## Related documentation

- `../../requirements/product-scope.md`
- `../../requirements/functional-requirements.md`
- `../../requirements/non-functional-requirements.md`
- `../domain-model.md`