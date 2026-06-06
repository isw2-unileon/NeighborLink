# ADR-004: Custom JWT authentication

## Status

Accepted

## Date

2026-02-16

## Context

The application needs to authenticate users on every protected API request. Two main approaches were considered:

- **Supabase Auth** — managed authentication service included with Supabase; handles registration, login, and session tokens automatically
- **Custom JWT** — the backend issues and validates its own signed tokens using `golang-jwt/jwt`

Since the backend is written in Go and manages its own user registration flow (including address geocoding at sign-up time), delegating auth to Supabase Auth would split the registration logic across two systems and introduce a dependency on an external auth provider for every request validation.

## Decision

Implement authentication in the backend using **HS256-signed JWT tokens** via the `golang-jwt/jwt/v5` library.

On login, the backend validates the user's credentials against the `users` table (bcrypt password comparison) and issues a signed token containing the `user_id`. The signing secret is loaded from the `JWT_SECRET` environment variable.

The `platform/middleware.RequireAuth` Gin middleware validates the token on every protected route and injects the `userID` string into the Gin context so handlers can retrieve it without re-parsing the token.

The system is fully stateless — no session table or token store is used. Token expiry is enforced by the JWT standard claims.

## Consequences

- No external auth provider dependency at request time — token validation is a local CPU operation.
- Registration and login logic live entirely in the `auth` module, keeping the geocoding and password hashing flow in one place.
- Token revocation is not supported without a deny-list; this is acceptable for the scope of this project.
- Rotating the `JWT_SECRET` invalidates all existing tokens, requiring users to log in again.
- The frontend stores the token in `localStorage` and attaches it as a `Bearer` header on every API request via the shared `api.ts` facade.