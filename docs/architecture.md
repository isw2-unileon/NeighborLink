# Architecture

## Overview

NeighborLink follows a **modular monolith** architecture on the backend. All business domains live inside a single Go binary but are strictly separated into independent packages under `backend/internal/`. Each package owns its domain types, repository interface, persistence implementation, optional service layer, and HTTP handlers. Modules communicate only through narrow interfaces — never by importing each other's concrete types directly.

The frontend is a React 19 single-page application that communicates exclusively with the backend REST API.

```
┌─────────────────────────────────────────────────────────┐
│                     React SPA (Vite)                    │
│   pages · components · contexts · lib (API facades)     │
└────────────────────┬────────────────────────────────────┘
                     │ HTTP / JSON  (/api/*)
┌────────────────────▼────────────────────────────────────┐
│                  Go HTTP Server (Gin)                   │
│                                                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐   │
│  │   auth   │ │  users   │ │listings  │ │  wallet   │   │
│  ├──────────┤ ├──────────┤ ├──────────┤ ├───────────┤   │
│  │messages  │ │  notifs  │              │transactions│  │
│  └──────────┘ └──────────┘              └───────────┘   │
│                                                         │
│  platform/  database · stripe · geocoder · middleware   │
└──────────────────┬──────────────────────────┬───────────┘
                   │ pgx/v5                   │ HTTPS
        ┌──────────▼──────────┐    ┌──────────▼──────────┐
        │  PostgreSQL+PostGIS │    │   Stripe API        │
        │  (Supabase)         │    │   + Connect         │
        └─────────────────────┘    └─────────────────────┘
                                        │ HTTPS
                               ┌────────▼────────┐
                               │  Nominatim API  │
                               │ (OpenStreetMap) │
                               └─────────────────┘
```

---

## Backend Module Structure

Every domain module follows the same internal structure:

```
<module>/
├── domain.go              # Domain types and constants (e.g. Transaction, Status)
├── repository.go          # Repository interface — the only port other modules may reference
├── postgres_repository.go # PostgreSQL adapter implementing the interface (pgx/v5)
├── service.go             # Business logic (only present when logic spans >1 repo call)
├── handler.go             # Gin HTTP handlers — thin layer, no business logic
└── handler_test.go        # Unit tests using fake in-memory repository implementations
```

This structure enforces the **Dependency Inversion Principle**: handlers and services depend on interfaces, never on concrete implementations. It also enables unit testing without a live database — each test file injects a fake repository.

---

## Backend Modules

| Module | Responsibility |
|---|---|
| `auth` | Registration (geocodes address via Nominatim), login, JWT issuance |
| `users` | Profile management, role resolution (`user` / `admin`), avatar upload to Supabase Storage |
| `listings` | CRUD of listings with PostGIS geolocation, photo upload, availability check, admin moderation |
| `transactions` | Full rental lifecycle, Stripe deposit flow, numeric code generation and validation |
| `messages` | Per-transaction chat; participant and admin access rules |
| `notifications` | In-app notification creation, listing, and read state management |
| `wallet` | Points accumulation, history, and cash redemption via Stripe Connect |
| `platform/database` | pgxpool connection pool initialisation |
| `platform/stripe` | Stripe client wrapping `AuthorizeDeposit`, `CaptureDeposit`, `ReleaseDeposit` |
| `platform/geocoder` | Nominatim HTTP client — resolves a text address to lat/lng coordinates |
| `platform/middleware` | `RequireAuth` Gin middleware — validates JWT and injects `userID` into context |
| `platform/adapters` | Thin adapter structs wiring concrete repositories to narrow cross-module interfaces |

---

## Dependency Wiring

All dependency injection happens at startup in `backend/cmd/server/main.go` inside `registerModules()`. No module constructs its own dependencies — they are all passed in from the outside (constructor injection).

Cross-module dependencies are always expressed as narrow interfaces defined in the consuming module, not as imports of the producing module's concrete types. For example, `transactions.Service` depends on a `pointsAdder` interface with a single `AddPoints` method; it never imports the `wallet` package directly. The concrete `walletModule.Service` is wired to that interface in `main.go`.

When a concrete type needs to satisfy an interface defined in another module, a small adapter struct is defined in `platform/adapters` or inline in `main.go`. This avoids import cycles and keeps package boundaries clean.

---

## Transaction Lifecycle

A rental goes through the following states:

```
pending ──(owner accept)──► awaiting_payment ──(borrower pays)──► agreed
   │                                                                  │
   └──(owner reject)──► cancelled              (owner confirms handover via code)
                                                                      │
                                                                  handed_over
                                                                      │
                                              ┌───(owner reports issue)──► pending_review
                                              │                                   │
                                              │                        (admin resolves)
                                              │                                   │
                                        (owner confirms return via code)           │
                                              │                                   ▼
                                              └─────────────────────────────► returned
```

State transitions are enforced in `transactions.Service`. Each transition has a guard that verifies the current status before proceeding. Stripe deposit operations (authorize → capture → release) are triggered at the corresponding transitions.

---

## Authentication

Authentication is handled with **JWT tokens** issued by the backend upon login. The token is signed with `HS256` using a secret loaded from the environment (`JWT_SECRET`). The `platform/middleware.RequireAuth` Gin middleware validates the token on every protected route and injects the `userID` string into the request context. No session storage is used — the system is fully stateless.

---

## External Services

| Service | Usage |
|---|---|
| **Supabase (PostgreSQL + PostGIS)** | Primary database; PostGIS extension enables geospatial queries for listing radius search |
| **Supabase Storage** | Binary file storage for user avatars and listing photos |
| **Stripe Payment Intents** | Manual-capture flow: authorize on pay, capture on handover, partial release on return |
| **Stripe Connect** | Points-to-cash redemption — payouts are sent to the lender's connected Stripe account |
| **Nominatim (OpenStreetMap)** | Free geocoding API called at user registration to convert the address text to lat/lng coordinates stored in the database |

---

## Frontend Architecture

The frontend is a React 19 SPA built with Vite 6. Routing is handled by React Router v7. Styling uses Tailwind CSS v4.

The `frontend/src/lib/` directory contains one API facade module per backend domain (`listings.ts`, `transactions.ts`, `messages.ts`, etc.). All HTTP calls go through a shared `api.ts` utility that injects the `Authorization` header from `localStorage` on every request. Components and pages never call `fetch` directly — they always go through these facades.

Auth state (token + user object) is managed in a React Context (`AuthContext`) so any component in the tree can read the current user without prop drilling.
```

