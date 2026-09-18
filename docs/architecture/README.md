# Architecture

This directory contains the architecture documentation for FitMap.

## Documentation

- [High-Level Architecture](high-level-architecture.md) — system context, application components, integration boundaries and delivery strategy.
- [Domain Model](domain-model.md) — core domain concepts, relationships and ownership rules.
- [Architecture Decision Records](decisions/) — significant technical decisions and their rationale.

## Architecture approach

FitMap uses a modular, production-oriented architecture while keeping infrastructure proportional to the current product and team.

The architecture prioritizes:

- clear business and module boundaries;
- separation between application, persistence and external integrations;
- backend-enforced security and ownership;
- reliable relational data and controlled schema evolution;
- testability and operational visibility;
- incremental evolution from the existing mobile prototype;
- avoiding distributed-system complexity without a demonstrated need.

Architecture documentation should reflect approved product and technical decisions rather than speculative future infrastructure.

Implementation details that do not require architectural history belong in the relevant code, configuration or technical documentation.