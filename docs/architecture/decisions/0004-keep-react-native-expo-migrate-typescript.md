# ADR 0004 — Keep React Native and Expo and Migrate to TypeScript

## Status

Accepted

## Context

FitMap already has a functional mobile prototype built with React Native and Expo.

The application needs to evolve into a more maintainable production-oriented codebase without introducing the cost and regression risk of a full mobile rewrite.

Most of the existing source code is JavaScript, while the project already has TypeScript configuration available.

## Decision

FitMap v1 will continue using **React Native with Expo**.

The existing application will be migrated incrementally from JavaScript to **TypeScript** rather than rewritten from scratch.

New production code should be written in TypeScript unless a specific reason justifies otherwise.

TypeScript strict mode will remain enabled, and `any` should not be used as the default migration strategy.

The migration should preserve working application behavior and occur gradually across shared types, services, hooks, components and screens.

Expo will remain part of the mobile architecture unless a concrete product requirement demonstrates a limitation that justifies additional native complexity.

The existing navigation approach will not be replaced solely for modernization purposes.

## Consequences

### Positive

- preserves the value of the working prototype;
- avoids unnecessary rewrite risk;
- improves refactoring and type safety;
- provides stronger contracts for backend integration;
- keeps Android and iOS development in one codebase.

### Trade-offs

- JavaScript and TypeScript will coexist during the migration;
- stricter typing may expose existing prototype inconsistencies;
- dependency and SDK upgrades must be handled incrementally.

These costs are preferable to a full rewrite.

## Alternatives considered

### Continue with JavaScript

Not selected because the growing domain and backend integration benefit from stronger compile-time contracts.

### Rewrite the application in TypeScript

Not selected because replacing working functionality would introduce unnecessary schedule and regression risk.

### Flutter or separate native applications

Not selected because React Native already provides a suitable cross-platform foundation and no current FitMap requirement justifies replacing it.

### Remove Expo

Not selected because no current product requirement demonstrates that Expo prevents the planned FitMap capabilities.

## Related documentation

- `0001-use-modular-monolith-backend.md`
- `0002-use-python-fastapi-backend.md`
- `../high-level-architecture.md`
- `../domain-model.md`
- `../../requirements/product-scope.md`