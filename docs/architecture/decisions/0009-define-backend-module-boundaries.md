# ADR 0009 — Define Backend Module Boundaries

## Status

Accepted

## Context

FitMap v1 uses a modular monolith backend architecture.

A modular monolith must provide more than visual folder separation. It requires explicit ownership of business behavior, application responsibilities and persisted data.

Without clear module boundaries, the backend could gradually become tightly coupled even if the source code is separated into directories.

Examples of undesirable coupling include:

- one module directly importing another module's persistence implementation;
- arbitrary cross-module database updates;
- business rules distributed across unrelated modules;
- circular module dependencies;
- authentication implementation details leaking into every product module;
- a shared package becoming a repository for unrelated domain logic.

FitMap therefore requires explicit backend module boundaries and dependency rules.

## Decision

FitMap v1 will organize the backend around four primary business modules:

```text
Identity
Gyms
Training
Progress