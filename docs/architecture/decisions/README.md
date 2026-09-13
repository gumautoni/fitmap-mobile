# Architecture Decision Records

This directory contains the Architecture Decision Records (ADRs) for FitMap.

ADRs are used to document important technical decisions that have meaningful architectural consequences.

Each ADR should describe:

- the context that motivated the decision;
- the problem being addressed;
- relevant alternatives considered;
- the selected decision;
- the main consequences and trade-offs.

## Naming convention

ADR files should follow this pattern:

`NNNN-short-decision-title.md`

Examples:

- `0001-mobile-application-stack.md`
- `0002-backend-architecture.md`
- `0003-database-technology.md`

ADR numbering is sequential and should not be reused.

## Status

An ADR may use one of the following statuses:

- Proposed
- Accepted
- Deprecated
- Superseded

Accepted ADRs should not be silently rewritten when the decision changes.

If an architectural decision is replaced, a new ADR should normally document the new decision and reference the previous one.