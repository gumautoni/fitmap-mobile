# ADR 0012 — Define Testing and Quality Strategy

## Status

Accepted

## Context

FitMap is evolving from a functional prototype into a production-oriented mobile and backend application.

The system contains behavior whose failure has different levels of impact.

Examples of high-risk behavior include:

- authentication and authorization;
- session rotation and revocation;
- user-data ownership;
- workout lifecycle rules;
- workout execution and history integrity;
- the one-active-workout-session invariant;
- custom exercise ownership;
- favorite and review uniqueness;
- progress-data privacy;
- private-media authorization;
- persistence constraints;
- cross-module invariants.

Other behavior, such as minor visual details, generally carries lower product and security risk.

FitMap therefore requires a testing strategy that provides strong confidence in critical behavior without creating excessive test-maintenance cost.

Quality must also include more than runtime tests.

The project requires automated validation of:

- Python code quality;
- Python typing;
- TypeScript typing;
- mobile code quality;
- formatting;
- database migrations;
- API integration;
- relational persistence;
- dependency and security health over time.

## Decision

FitMap will adopt a **risk-based, layered testing and quality strategy**.

Testing effort should be proportional to:

- product impact;
- security impact;
- regression risk;
- persistence complexity;
- integration complexity.

The project will not pursue testing metrics or architectural patterns solely for appearance or arbitrary completeness.

Conceptually:

```text
                 Critical E2E tests
                        |
                API / Integration
                        |
             Application / Domain
                        |
         Unit / Component-level tests
                        |
        Static analysis + type checking