# ADR 0013 — Define Observability and Operational Health Strategy

## Status

Accepted

## Context

FitMap is being designed as a production-oriented mobile and backend system.

Once the application is deployed, failures cannot be diagnosed reliably through local debugging or manual inspection alone.

The system will contain multiple technical boundaries, including:

- React Native / Expo mobile application;
- FastAPI backend;
- PostgreSQL;
- authentication and session management;
- external gym and location providers;
- private object storage;
- future background or asynchronous operations;
- CI/CD and deployment infrastructure.

Operational failures may occur in different parts of the system.

Examples include:

- API errors;
- authentication failures;
- database availability issues;
- slow database operations;
- external-provider timeouts;
- media-storage failures;
- invalid configuration;
- unexpected exceptions;
- mobile runtime crashes;
- degraded dependencies.

FitMap therefore requires enough operational visibility to answer questions such as:

- what failed;
- when it failed;
- which request was affected;
- which application version was running;
- whether a dependency was responsible;
- whether the problem is isolated or systemic;
- whether the application is currently healthy.

At the same time, observability must not create unnecessary infrastructure complexity or expose sensitive user information.

## Decision

FitMap v1 will use a **progressive observability strategy** based initially on:

- structured application logging;
- request and correlation identifiers;
- health and readiness endpoints;
- essential operational metrics;
- centralized error reporting;
- selected security-event logging;
- telemetry redaction and data minimization.

Distributed tracing and large dedicated observability platforms are not mandatory for the initial version.

Observability infrastructure will grow when demonstrated operational requirements justify the additional complexity.

## Observability principles

FitMap should emit enough operational information to explain failures and system health without exposing secrets or collecting unnecessary user data.

Operational telemetry must remain distinct from:

- primary business persistence;
- user analytics;
- product behavior tracking.

Observability exists primarily to operate, diagnose and protect the application.

## Structured logging

Backend application logs should use structured events rather than rely primarily on free-form human-readable messages.

A conceptual production log entry may resemble:

```json
{
  "timestamp": "2026-09-18T02:15:30Z",
  "level": "INFO",
  "event": "workout_session_completed",
  "request_id": "request-id",
  "user_id": "opaque-user-id",
  "session_id": "opaque-session-id"
}