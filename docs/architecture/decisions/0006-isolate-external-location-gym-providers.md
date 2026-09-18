# ADR 0006 — Isolate External Location and Gym Providers

## Status

Accepted

## Context

FitMap depends on external services for capabilities such as gym discovery, geocoding and location-related data.

External providers may change response formats, identifiers, limits, availability or commercial terms.

Allowing provider-specific data structures to spread through the application would make the FitMap domain dependent on external implementation details.

## Decision

External location and gym services will be accessed through backend provider adapters.

Provider-specific request and response models remain inside the integration boundary.

The backend normalizes relevant external data before exposing it to the rest of the application.

FitMap owns its internal `Gym` identity.

External provider identifiers are stored as references to a FitMap gym and are not used as the primary domain identity.

A gym may have references to more than one external provider when needed.

The application must distinguish between a transient external search result and a persisted FitMap gym record.

Provider integrations should define reasonable handling for:

- timeouts;
- retries;
- rate limits;
- caching;
- unavailable or incomplete responses.

Missing external information must remain unavailable rather than being replaced with fabricated values.

Secrets or credentials required by providers must remain on the backend.

Client-side SDKs used only for presentation, such as map rendering, may remain directly integrated with the mobile application when appropriate and when they do not expose protected backend credentials.

## Consequences

### Positive

- the FitMap domain remains independent from individual providers;
- providers can be replaced or supplemented with lower impact;
- internal gym references remain stable;
- external failures can be handled consistently;
- provider-specific secrets remain outside the mobile application.

### Trade-offs

- integration adapters and normalization add backend code;
- external data may require reconciliation when different providers describe the same gym differently;
- caching and rate-limit behavior must be implemented carefully.

These costs are preferable to coupling core FitMap behavior directly to third-party APIs.

## Alternatives considered

### Call external gym APIs directly from the mobile application

Not selected because it would expose integration details to the client and make centralized normalization, caching and secret management harder.

### Use provider IDs as FitMap gym IDs

Not selected because provider identifiers belong to external systems and may not remain stable across provider changes.

### Use a single provider permanently

Not adopted as an architectural restriction. FitMap may initially use one provider, but the domain should not depend on that provider remaining permanent.

## Related documentation

- `0001-use-modular-monolith-backend.md`
- `../high-level-architecture.md`
- `../domain-model.md`
- `../../requirements/product-scope.md`