# ADR 0005 — Keep React Native and Expo and Migrate to TypeScript

## Status

Accepted

## Context

FitMap already has a functional mobile prototype built with React Native and Expo.

The current application includes capabilities such as:

- navigation;
- location access;
- map integration;
- camera access;
- forms and screens;
- local state;
- external API integration.

The project also already contains TypeScript configuration, including strict-mode support, while a significant portion of the application is still implemented in JavaScript.

FitMap must evolve from a functional prototype into a maintainable production-oriented mobile application without introducing unnecessary rewrite risk.

The mobile architecture must support:

- Android and iOS;
- backend API integration;
- authentication and session management;
- location and map capabilities;
- camera and media workflows;
- workout planning and execution;
- progress tracking;
- automated testing;
- maintainable application structure;
- explicit typing;
- future CI/CD and release workflows.

## Decision

FitMap v1 will continue using **React Native with Expo** as its mobile application platform.

The existing application will not be rewritten in another mobile framework without a demonstrated technical or product requirement.

FitMap will migrate incrementally from JavaScript to **TypeScript**.

New production application code should be written in TypeScript unless a justified exception exists.

The migration must preserve working application behavior and should be performed incrementally rather than through a full application rewrite.

## Architectural principles

### Preserve the working application

Migration and modernization work should minimize unnecessary regressions.

The preferred evolution strategy is:

```text
working JavaScript prototype
        |
        v
incremental TypeScript migration
        |
        v
fully typed mobile application