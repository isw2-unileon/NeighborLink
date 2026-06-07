# ADR-003: Nominatim (OpenStreetMap) for geocoding

## Status

Accepted

## Date

2026-02-16

## Context

User addresses must be converted to geographic coordinates (lat/lng) at registration time so that listings can be searched by proximity using PostGIS. We need a geocoding service that the backend can call via HTTP.

The main candidates considered were:

- **Google Maps Geocoding API** — highly accurate, global coverage, but requires a billing account and charges per request
- **Nominatim (OpenStreetMap)** — free, no API key required, open data, sufficient accuracy for residential addresses in Spain
- **Mapbox Geocoding API** — good quality, has a free tier but with request limits and requires account registration

## Decision

Use the **Nominatim OpenStreetMap API** (`https://nominatim.openstreetmap.org/search`) via a lightweight HTTP client implemented in `backend/internal/platform/geocoder/geocoder.go`.

The client sends the user's address as a URL-encoded query string, sets a `User-Agent: NeighborLink/1.0` header as required by the Nominatim usage policy, and parses the first result's `lat`/`lon` fields. If no result is returned the registration still succeeds but the user is stored without coordinates.

No third-party Go library is used — the implementation is a single function using the standard `net/http` and `encoding/json` packages.

## Consequences

- No API key or billing account is required, keeping infrastructure costs at zero.
- Nominatim's usage policy limits request rate; this is acceptable for a university project with low traffic.
- Geocoding accuracy depends on OpenStreetMap data quality, which is sufficient for Spanish addresses.
- If a user enters an unrecognisable address, the registration fails with a `422 Unprocessable Entity` response and a human-readable error message.
- Switching to a different geocoding provider in the future only requires replacing the implementation of the `Geocode` function in `platform/geocoder/` — no other module is affected.
```

