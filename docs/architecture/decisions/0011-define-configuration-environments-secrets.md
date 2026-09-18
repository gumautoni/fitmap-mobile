# ADR 0011 — Define Configuration, Environments and Secrets Management

## Status

Accepted

## Context

FitMap consists of multiple runtime components with different configuration and security requirements, including:

- a React Native / Expo mobile application;
- a Python / FastAPI backend;
- PostgreSQL;
- external gym and location providers;
- private object storage;
- authentication and session-management infrastructure;
- future CI/CD and deployment environments.

These components require environment-specific configuration.

Examples include:

- API base URLs;
- database connection information;
- authentication keys;
- token configuration;
- external-provider credentials;
- object-storage configuration;
- logging configuration;
- feature or runtime settings.

FitMap must avoid environment-specific source-code changes and must prevent secrets from being committed to source control or embedded in public client applications.

The project must also distinguish clearly between:

- Python virtual environments;
- local environment-variable files;
- application environments;
- sensitive secrets;
- public mobile configuration.

## Decision

FitMap will use **external environment-specific configuration** rather than environment-specific source-code modifications.

Backend configuration will be:

- centrally loaded;
- explicitly modeled;
- typed;
- validated during application startup.

Mandatory configuration that is missing or invalid must cause the application to fail during startup rather than fail later during an unrelated runtime operation.

FitMap will distinguish at least the following runtime environments:

```text
development
test
staging
production