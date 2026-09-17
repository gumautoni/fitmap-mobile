# ADR 0003 — Use PostgreSQL as the Primary Database

## Status

Accepted

## Context

FitMap manages strongly related application data across multiple product domains.

Relevant relationships include:

- users and profiles;
- users and workouts;
- workouts and workout exercises;
- exercises and workouts;
- users and workout sessions;
- workout sessions and exercise executions;
- exercise executions and set executions;
- users and favorite gyms;
- users and gym reviews;
- gyms and external provider references;
- users and progress records.

Several FitMap domain rules require strong consistency.

Examples include:

- a favorite gym relationship should not be duplicated for the same user and gym;
- workout sessions must remain associated with the correct user;
- historical workout execution must preserve valid relationships;
- exercise executions must belong to valid workout sessions;
- set executions must remain associated with valid exercise executions;
- user-owned records must remain isolated between different accounts.

FitMap therefore requires a persistence technology capable of supporting:

- relational integrity;
- transactional operations;
- uniqueness constraints;
- referential constraints;
- indexes;
- structured querying;
- aggregation;
- schema evolution;
- reliable production operation.

The database architecture must remain appropriate for the modular monolith established for FitMap v1.

## Decision

FitMap v1 will use **PostgreSQL** as its primary transactional database.

The initial backend architecture will use a single PostgreSQL database rather than independent databases for each backend module.

A shared physical database does not imply unrestricted ownership of all persisted data by all modules.

Backend modules must maintain explicit logical ownership of their domain data.

Conceptually, ownership is expected to align approximately with the FitMap domain boundaries:

```text
PostgreSQL
|
|-- Identity and Profile
|   |-- users
|   |-- profiles
|   `-- preferences
|
|-- Gym Discovery
|   |-- gyms
|   |-- external provider references
|   |-- favorites
|   `-- reviews
|
|-- Training
|   |-- exercises
|   |-- workouts
|   |-- workout exercises
|   |-- workout sessions
|   |-- exercise executions
|   `-- set executions
|
`-- Progress
    |-- progress photo metadata
    |-- body metrics
    `-- fitness goals