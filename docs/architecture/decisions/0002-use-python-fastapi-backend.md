# ADR 0002 — Use Python and FastAPI for the Backend API

## Status

Accepted

## Context

FitMap requires a backend API responsible for product capabilities including:

- authentication and authorization;
- user and profile management;
- gym-related persistent relationships;
- workout planning;
- workout execution;
- training history;
- progress tracking;
- integration with external services;
- media-related metadata.

The backend must support the modular monolith architecture established for FitMap v1.

The selected backend technology should provide:

- strong support for HTTP APIs;
- explicit request and response contracts;
- input validation;
- maintainable modular organization;
- automated testing;
- asynchronous capabilities where appropriate;
- clear integration with relational persistence;
- strong development productivity;
- sufficient ecosystem maturity;
- compatibility with professional deployment and CI/CD practices.

The framework must support the application architecture without becoming the architecture itself.

FitMap business rules must remain separated from HTTP transport, persistence and framework-specific concerns.

## Decision

FitMap v1 will use **Python** as the backend programming language and **FastAPI** as the HTTP/API delivery framework.

FastAPI will be responsible primarily for concerns such as:

- HTTP routing;
- request parsing;
- request and response validation;
- API serialization;
- dependency integration at the delivery boundary;
- HTTP status handling;
- generated API documentation.

FastAPI route handlers must not become the primary location for FitMap business rules.

The backend should maintain explicit separation between concerns such as:

```text
HTTP / API delivery
        |
        v
Application use cases
        |
        v
Domain rules
        |
        v
Persistence and external infrastructure