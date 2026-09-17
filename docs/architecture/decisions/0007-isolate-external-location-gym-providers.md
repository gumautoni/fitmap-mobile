# ADR 0007 — Isolate External Location and Gym Providers Behind Backend Adapters

## Status

Accepted

## Context

FitMap depends on external data and services for capabilities such as:

- nearby gym discovery;
- place information;
- geocoding;
- reverse geocoding;
- routing;
- geographic coordinates;
- addresses;
- provider-specific establishment metadata.

These capabilities are not fully owned by FitMap.

External providers may:

- expose different data models;
- use provider-specific identifiers;
- impose rate limits;
- experience outages;
- change response formats;
- return incomplete data;
- require credentials;
- apply different usage and caching policies.

The FitMap domain must not become dependent on one provider's representation.

The existing prototype also demonstrated the risk of compensating for missing external data with fabricated gym information.

Production FitMap behavior must instead preserve the distinction between real provider data, FitMap-owned data and unavailable information.

## Decision

FitMap will isolate business-relevant external gym, geocoding and routing integrations behind **backend-owned provider abstractions and adapters**.

The mobile application will normally request business-relevant gym and location information through the FitMap backend rather than depending directly on external business-data provider contracts.

Conceptually:

```text
FitMap Mobile
      |
      | HTTPS
      v
FitMap Backend
      |
      v
Gym / Location Application Logic
      |
      v
Provider Abstractions
      |
      +-- Gym / Places Provider
      +-- Geocoding Provider
      `-- Routing Provider