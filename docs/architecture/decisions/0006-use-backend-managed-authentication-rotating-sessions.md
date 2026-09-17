# ADR 0006 — Use Backend-Managed Authentication and Rotating Sessions

## Status

Accepted

## Context

The FitMap prototype currently contains local authentication behavior that was sufficient for validating the initial application flow but is not appropriate for a production-oriented system.

FitMap v1 requires authentication and session management capable of supporting:

- secure user registration and login;
- password-based authentication;
- authenticated mobile API requests;
- session expiration;
- session renewal;
- logout and session revocation;
- multiple application sessions when appropriate;
- secure mobile credential storage;
- account recovery;
- future email verification;
- strict authorization and ownership enforcement.

Authentication must be controlled by the backend rather than implemented as a local-only mobile mechanism.

The architecture must also minimize the impact of stolen credentials or tokens and must avoid storing plaintext passwords or long-lived authentication secrets in general-purpose mobile storage.

## Decision

FitMap v1 will use **backend-managed email and password authentication**.

The authentication architecture will use:

- password hashing with Argon2id;
- short-lived signed JWT access tokens;
- opaque cryptographically random refresh tokens;
- refresh-token rotation;
- server-side session state;
- secure refresh-token storage on the mobile device;
- server-side session revocation;
- explicit backend authorization and resource-ownership validation.

Conceptually:

```text
FitMap Mobile
      |
      | email + password
      v
Authentication API
      |
      +-- verify account
      +-- verify password hash
      +-- create server session
      |
      +--> short-lived access token
      |
      `--> rotating refresh token