# ADR 0008 — Store Private Media in Object Storage

## Status

Accepted

## Context

FitMap includes user-owned progress photos as part of the progress-tracking domain.

Progress photos have different storage characteristics from the relational application data stored in PostgreSQL.

The system must support:

- durable photo storage;
- private user ownership;
- secure upload and download;
- backend authorization;
- mobile camera workflows;
- scalable media delivery;
- future image processing;
- object cleanup;
- metadata persistence;
- operational independence between application instances.

The current mobile prototype uses local device file URIs.

A local URI is not a durable application-level reference because the file is tied to a specific device and local application lifecycle.

The production architecture must therefore separate the FitMap `ProgressPhoto` domain record from the physical image object.

## Decision

FitMap will store progress-photo binary files in **private object storage**.

PostgreSQL will store FitMap-owned metadata and storage references rather than the image binary itself.

Conceptually:

```text
ProgressPhoto
|-- FitMap identity
|-- user ownership
|-- recorded timestamp
|-- storage reference
|-- relevant media metadata
`-- optional WorkoutSession relationship

Object Storage
`-- actual image binary