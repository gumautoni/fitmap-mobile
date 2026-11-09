# ADR 0006 — Establish a safe password recovery foundation

## Status

Accepted for **Ciclo 24.2 foundation only**. No public password recovery routes or mail provider are activated in this change.

## Context

FIT Map currently allows email/password registration without proving the user controls that address. Therefore existing accounts cannot be assumed to have a verified recovery address. Email-only account recovery must not be enabled for these accounts until a verified ownership process exists.

## Decisions

- Persist a nullable `users.email_verified_at`, without backfilling old accounts or marking new registrations as verified.
- Persist per-account recovery challenges linked by `user_id` and protected with a keyed HMAC-SHA256; never store the six-digit plaintext code.
- Use an independent recovery-only secret supplied by the backend at runtime. Missing/weak configuration fails closed; never reuse the JWT secret by default.
- Use cryptographically secure six-digit random codes, 10-minute expiry, one-time use, and five attempts per issued code.
- Enforce a 60-second issue cooldown and a limit of three issued challenges per account per hour; a new issuance invalidates older outstanding codes.
- Serialize issue and reset operations using a PostgreSQL user-row lock to prevent concurrent resets and double use.
- Reuse the registration password policy for a new password. Successful reset changes only the Argon2id hash, revokes **all** user sessions and refresh tokens, and consumes outstanding recovery codes. It never logs the user in.
- Expose a sender interface to allow a future real mail provider and a fake test sender. No plaintext code may appear in logs, HTTP responses or the database.
- Keep recovery logic internal until email verification, delivery failure handling, anti-enumeration timing and IP/network rate limiting have been implemented and tested.

## Required before enabling the feature

1. Verified email ownership for both new and legacy users, with an explicit migration/verification flow.
2. A real mail delivery provider with server-only credentials, secret management and safe handling of sending failures. Do not send a code until it has been durably persisted; choose an appropriate transactional/outbox strategy.
3. Uniform public responses for unknown, unverified and known emails, avoiding timing discrepancies and account enumeration.
4. Request throttling by IP/network and email identifier, ideally at an edge or shared store; add monitoring that excludes secret values and personal identifiers.
5. End-to-end HTTP, concurrency, retry, provider failure and mobile tests before exposing routes and UI.

## Scope exclusions

There are deliberately no public `/auth/password-recovery/*` endpoints, new mobile screens, fake/simulated production senders, or production recovery enablement in this change.

## References

- OWASP Forgot Password Cheat Sheet
- OWASP Email Validation and Verification Cheat Sheet
- OWASP Multifactor Authentication Cheat Sheet (OTP handling)
