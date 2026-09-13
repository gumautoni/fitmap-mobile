# FitMap Requirements

This directory contains the version-controlled product and system requirements for FitMap.

The requirements documentation defines what FitMap is expected to provide and which quality attributes the system must preserve throughout its evolution.

---

## Documentation index

### Product scope

[`product-scope.md`](./product-scope.md)

Defines:

- product vision;
- target users;
- user problems;
- value proposition;
- product pillars;
- FitMap v1 scope;
- scope exclusions;
- product-quality principles;
- product success criteria.

This document defines the boundaries of the product.

---

### Functional requirements

[`functional-requirements.md`](./functional-requirements.md)

Defines the observable capabilities and behavior expected from FitMap.

Functional requirements use domain-based identifiers such as:

- `FR-AUTH-*`
- `FR-PROFILE-*`
- `FR-GYM-*`
- `FR-GYMDET-*`
- `FR-FAV-*`
- `FR-COMP-*`
- `FR-WORKOUT-*`
- `FR-SESSION-*`
- `FR-HISTORY-*`
- `FR-PROGRESS-*`
- `FR-REVIEW-*`
- `FR-NOTIF-*`
- `FR-UX-*`

Functional requirements describe required behavior without unnecessarily prescribing implementation technology.

---

### Non-functional requirements

[`non-functional-requirements.md`](./non-functional-requirements.md)

Defines the quality attributes, constraints and operational expectations of FitMap.

Non-functional requirements currently cover areas such as:

- security;
- privacy;
- data integrity;
- reliability;
- performance;
- availability;
- maintainability;
- testability;
- observability;
- accessibility;
- usability;
- compatibility;
- configuration;
- version control;
- documentation;
- deployment;
- scalability.

Identifiers use domain-based prefixes such as:

- `NFR-SEC-*`
- `NFR-PRIV-*`
- `NFR-DATA-*`
- `NFR-REL-*`
- `NFR-PERF-*`
- `NFR-AVAIL-*`
- `NFR-MAINT-*`
- `NFR-TEST-*`
- `NFR-OBS-*`
- `NFR-ACC-*`
- `NFR-UX-*`
- `NFR-COMPAT-*`
- `NFR-CONFIG-*`
- `NFR-VCS-*`
- `NFR-DOC-*`
- `NFR-DEPLOY-*`
- `NFR-SCALE-*`

---

## Requirement identifiers

Requirement identifiers are intended to remain stable references throughout the project lifecycle.

Example:

`FR-WORKOUT-001`

means:

- `FR`: Functional Requirement;
- `WORKOUT`: requirement domain;
- `001`: sequential identifier inside that domain.

Likewise:

`NFR-SEC-005`

means:

- `NFR`: Non-Functional Requirement;
- `SEC`: security quality area;
- `005`: sequential identifier inside that area.

Identifiers should not be reused for unrelated behavior after a requirement is removed or superseded.

---

## Source-of-truth principle

The version-controlled requirement documents in this directory are the technical source of truth for the approved FitMap product requirements.

GitHub Issues, Pull Requests and implementation documentation should reference these requirements rather than redefining them inconsistently.

The academic TCC documentation may present the same requirements in a format appropriate for the institution, but its technical meaning should remain consistent with the repository documentation.

---

## Traceability model

FitMap should progressively maintain traceability across the development lifecycle.

The expected relationship is:

`Product scope → Requirement → GitHub Issue → Pull Request → Implementation → Validation`

Example:

`FR-WORKOUT-001 → workout creation Issue → implementation Pull Request → workout service and mobile flow → automated tests`

A single implementation task may satisfy more than one requirement.

Likewise, a non-functional requirement may affect several features.

Example:

`NFR-SEC-005`

may apply to:

- workout endpoints;
- progress endpoints;
- profile endpoints;
- favorite gyms;
- reviews.

For this reason, traceability should be based on meaningful references rather than duplicating requirements inside multiple documents.

---

## GitHub Issue references

Implementation Issues should reference relevant requirement identifiers whenever practical.

Example:

```text
Requirements:
- FR-AUTH-004
- FR-AUTH-006
- NFR-SEC-004
- NFR-SEC-008