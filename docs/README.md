# FitMap Technical Documentation

This directory contains the technical documentation used to design, implement and maintain FitMap.

The documentation should evolve together with the application and remain consistent with the actual implementation.

## Structure

### `architecture/`

Contains system architecture documentation, diagrams, technical boundaries and architectural decisions.

### `architecture/decisions/`

Contains Architecture Decision Records (ADRs) for relevant technical decisions.

ADRs should document the context, considered alternatives, selected decision and consequences of important architectural choices.

### `requirements/`

Contains the functional and non-functional requirements of FitMap.

### `mobile-development.md`

Documents the supported mobile development workflow, environment configuration, validation commands and React Native/Expo development conventions.

### `mobile-dependency-security.md`

Documents the mobile dependency security baseline, remediation
decisions, scoped overrides, validation evidence and residual
development dependency risks.

### `dependency-audit.md`

Documents automated dependency auditing, CI blocking policy,
security remediation evidence and operational limitations.

### `testing.md`

Documents the automated testing strategy, local validation commands, test isolation requirements and the relationship between local testing and CI.

### `qa-final-postintegration-2026-11-23.md`

Records the post-integration QA checkpoint for GitHub Stack #92,
the consolidated `main` commit, automated test evidence,
security follow-up and outstanding physical validation.

### `deployment.md`

Documents the current backend container and deployment foundation, including:

- Docker image construction;
- local Docker Compose integration;
- runtime configuration and secret handling;
- explicit database migration procedures;
- Pull Request container validation;
- immutable backend artifacts published to GitHub Container Registry;
- staging-before-production promotion;
- rollback considerations;
- current infrastructure limitations.

The deployment process follows ADR 0009 and intentionally remains provider-neutral until a concrete staging or production hosting platform is selected.

## Documentation principles

Technical documentation should:

- reflect the actual state of the project;
- clearly distinguish implemented functionality from planned functionality;
- explain relevant architectural decisions and trade-offs;
- avoid duplicating information unnecessarily;
- be updated when significant technical changes are introduced.