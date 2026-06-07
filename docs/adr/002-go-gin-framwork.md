# ADR-002: Go with Gin as the backend framework

## Status

Accepted

## Date

2026-02-16

## Context

We need a backend language and HTTP framework to implement a REST API serving a React frontend. The API must handle concurrent requests efficiently, integrate with PostgreSQL via pgx, call external services (Stripe, Nominatim, Supabase Storage), and be straightforward to test with fake repository implementations.

The main candidates considered were:

- **Go + Gin** — compiled, statically typed, excellent concurrency model via goroutines, minimal runtime overhead
- **Node.js + Express** — same language as the frontend, large ecosystem, but dynamically typed and single-threaded by default
- **Python + FastAPI** — fast to prototype, but slower at runtime and requires more tooling for type safety

## Decision

Use **Go 1.25** as the backend language with **Gin** as the HTTP framework.

Gin was chosen over the Go standard library `net/http` because it provides route parameter extraction, middleware chaining, request binding with validation (`ShouldBindJSON`), and JSON response helpers out of the box — all without adding significant complexity or runtime overhead.

The module structure (`internal/<domain>/handler.go`, `service.go`, `repository.go`) maps naturally onto Go packages, enforcing hard compile-time boundaries between domains that would require discipline to maintain in a dynamically typed language.

## Consequences

- The backend is a single compiled binary with no runtime interpreter dependency.
- Unit tests inject fake repository implementations through Go interfaces — no database required to run the test suite.
- The team must be familiar with Go's explicit error handling and interface-based polymorphism.
- Adding a new domain module means creating a new package under `backend/internal/` following the established structure.
- Go's standard `log/slog` package is used for structured JSON logging with no additional dependency.


