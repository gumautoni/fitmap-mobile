# ADR 0010 — Define REST API Design and Versioning

## Status

Accepted

## Context

FitMap consists of a React Native mobile application communicating with a FastAPI backend.

The communication boundary between these applications must remain:

- explicit;
- predictable;
- versionable;
- testable;
- secure;
- independent from persistence implementation details.

As the product grows, the API will support capabilities including:

- authentication;
- user profile management;
- gym discovery;
- favorites;
- reviews;
- workout planning;
- workout execution;
- training history;
- progress photos;
- body metrics;
- fitness goals.

Without consistent API conventions, individual endpoints could evolve incompatible approaches to:

- resource naming;
- validation;
- error responses;
- pagination;
- filtering;
- timestamps;
- authorization;
- retry behavior.

The API must therefore define a stable application contract rather than expose PostgreSQL tables or internal FastAPI implementation details directly.

## Decision

FitMap v1 will expose a **versioned RESTful HTTP API using JSON over HTTPS**.

The initial API base path will be:

```text
/api/v1