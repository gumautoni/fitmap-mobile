# ADR 0002 — Use Python and FastAPI for the Backend

## Status

Accepted

## Context

FitMap requires a backend API for authentication, gym discovery, workout management, progress tracking and integration with external services.

The backend technology should support clear API contracts, validation, automated testing and the modular monolith architecture without imposing unnecessary framework complexity.

## Decision

FitMap v1 will use **Python** as the backend language and **FastAPI** as the HTTP API framework.

FastAPI is responsible for transport concerns such as:

- routing;
- request and response validation;
- serialization;
- HTTP status handling;
- OpenAPI generation.

Business rules must remain outside route handlers whenever practical.

The intended dependency direction is:

```text
HTTP / FastAPI
      |
      v
Application use cases
      |
      v
Domain behavior
      |
      v
Persistence and external infrastructure