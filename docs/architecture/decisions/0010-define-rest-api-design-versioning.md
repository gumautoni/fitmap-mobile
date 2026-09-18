# ADR 0010 — Define REST API Design and Versioning

## Status

Accepted

## Context

FitMap requires a stable HTTP API between the mobile application and backend.

The API must expose product capabilities consistently without leaking persistence details or coupling the client to internal backend implementation.

The project also needs a clear strategy for evolving public API contracts over time.

## Decision

FitMap will expose a **REST-oriented HTTP API using JSON over HTTPS**.

Version 1 endpoints will use the prefix:

```text
/api/v1