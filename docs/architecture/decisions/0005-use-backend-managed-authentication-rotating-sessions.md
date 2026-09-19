# ADR 0005 — Use Backend-Managed Authentication and Rotating Sessions

## Status

Accepted

## Context

FitMap requires authentication that works consistently across the mobile application and backend and protects private user data.

The prototype's local authentication approach is not suitable for production because authentication, authorization and session control must be enforced by the backend.

The application also needs a way to keep users signed in without relying on long-lived access credentials.

## Decision

FitMap will use backend-managed email and password authentication.

Passwords will be stored using **Argon2id** password hashing.

Authenticated sessions will use:

- short-lived signed JWT access tokens;
- opaque rotating refresh tokens;
- server-side session state.

Access tokens are used for authenticated API requests and should remain short-lived.

Refresh tokens are used to renew sessions and are rotated after successful use. The backend retains enough session state to support expiration, revocation and detection of invalid token reuse.

On the mobile application:

- the active access token should normally remain in application memory;
- the refresh token is stored using Expo SecureStore or an equivalent approved secure-storage mechanism;
- sensitive session credentials must not be stored in AsyncStorage.

Logout revokes the corresponding server-side session in addition to removing local credentials.

Authentication and authorization remain separate concerns. A valid session identifies the user, but each backend operation must still verify resource ownership and permissions.

For user-owned operations, ownership is derived from the authenticated identity rather than trusted from an arbitrary client-provided `user_id`.

Exact token lifetimes, signing configuration and password-hashing parameters will be defined during implementation and security configuration.

## Consequences

### Positive

- authentication is enforced centrally by the backend;
- passwords are never stored in plaintext;
- short-lived access tokens limit credential exposure;
- sessions can be revoked server-side;
- refresh-token rotation supports stronger session control;
- sensitive mobile credentials use secure platform storage.

### Trade-offs

- session state and token rotation add more backend complexity than a single long-lived JWT;
- refresh flows must handle expiration, revocation and concurrent requests correctly;
- authentication behavior requires strong automated testing.

These costs are justified because authentication protects private FitMap data.

## Alternatives considered

### Local-only mobile authentication

Rejected because it cannot provide reliable backend identity, authorization or multi-device session control.

### Single long-lived JWT

Not selected because it provides weaker revocation and increases the impact of token theft.

### Stateless refresh tokens only

Not selected because server-side session state provides clearer revocation and rotation control.

### Full OAuth authorization server

Not selected because FitMap currently controls its own first-party mobile application and backend. External identity providers may be considered separately in the future.

## Related documentation

- `0001-use-modular-monolith-backend.md`
- `0002-use-python-fastapi-backend.md`
- `0004-keep-react-native-expo-migrate-typescript.md`
- `../high-level-architecture.md`
- `../domain-model.md`
