
# NeighborLink

> A collaborative economy platform for borrowing and renting everyday objects between neighbours.

NeighborLink lets users list objects they are not using and lend them to nearby neighbours. The platform handles the full rental lifecycle: request, secure payment with Stripe deposit hold, numeric-code-validated handover and return, dispute resolution, and a points-based reward system for lenders.

[![Backend CI](https://github.com/isw2-unileon/NeighborLink/actions/workflows/backend.yml/badge.svg)](https://github.com/isw2-unileon/NeighborLink/actions/workflows/backend.yml)
[![Frontend CI](https://github.com/isw2-unileon/NeighborLink/actions/workflows/frontend.yml/badge.svg)](https://github.com/isw2-unileon/NeighborLink/actions/workflows/frontend.yml)
[![CodeQL](https://github.com/isw2-unileon/NeighborLink/actions/workflows/codeql.yml/badge.svg)](https://github.com/isw2-unileon/NeighborLink/actions/workflows/codeql.yml)

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Local Setup](#local-setup)
- [Available Commands](#available-commands)
- [Running the Tests](#running-the-tests)
- [Project Structure](#project-structure)
- [API Reference](#api-reference)
- [CI/CD](#cicd)
- [Contributing](#contributing)
- [Technical Documentation](#technical-documentation)

---

## Features

- **Address geocoding** — user addresses are resolved to coordinates at registration time via Nominatim (OpenStreetMap), stored as PostGIS points
- **Geolocation search** — find listings within a configurable radius using PostGIS
- **Deposit management** — Stripe manual-capture holds funds on the borrower's card until physical handover is confirmed
- **Numeric code validation** — dynamic one-time codes confirm physical handover and return between owner and borrower
- **Integrated chat** — per-transaction messaging between owner and borrower
- **Points wallet** — lenders earn points redeemable for cash via Stripe Connect
- **Admin panel** — dispute resolution, listing moderation and points refunds

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Go 1.25, Gin, pgx/v5 |
| Frontend | React 19, TypeScript, Vite 6, Tailwind CSS 4 |
| Database | PostgreSQL + PostGIS (via Supabase) |
| File Storage | Supabase Storage (avatars and listing photos) |
| Geocoding | Nominatim (OpenStreetMap) |
| Auth | JWT — `golang-jwt/jwt v5` |
| Payments | Stripe Payment Intents with manual capture + Stripe Connect (`stripe-go v76`) |
| Unit Testing | Go `testing` + `testify`; Vitest + Testing Library |
| E2E Testing | Playwright |
| CI/CD | GitHub Actions |

---

## Prerequisites

| Tool | Minimum version | Download |
|---|---|---|
| Go | 1.25 | https://go.dev/dl/ |
| Node.js | 22 | https://nodejs.org/ |
| Make | any | pre-installed on macOS / Linux |

You will also need accounts on:

- **Supabase** — PostgreSQL database with PostGIS and Storage enabled
- **Stripe** — account with test mode active and a webhook endpoint configured

---

## Local Setup

### 1. Clone the repository

```bash
git clone https://github.com/isw2-unileon/NeighborLink.git
cd NeighborLink
```

### 2. Configure environment variables

Create `backend/.env`:

```env
# Server
PORT=8080
GIN_MODE=debug
CORS_ALLOW_ORIGIN=http://localhost:5173

# Database (Supabase PostgreSQL connection string)
DATABASE_URL=postgresql://postgres:<password>@<host>:5432/postgres

# Authentication
JWT_SECRET=change-this-in-production

# Supabase Storage
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_KEY=<service-role-key>

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

Create `frontend/.env`:

```env
VITE_API_URL=http://localhost:8080
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

> **Never commit `.env` files.** They are already listed in `.gitignore`.

### 3. Install dependencies

```bash
make install
```

### 4. Run the app

Open two terminals:

```bash
# Terminal 1 — Backend on http://localhost:8080
make run-backend

# Terminal 2 — Frontend on http://localhost:5173
make run-frontend
```

Open http://localhost:5173. The Vite dev server automatically proxies `/api` and `/health` to the Go backend.

---

## Available Commands

| Command | Description |
|---|---|
| `make install` | Install all dependencies (Go + Node) |
| `make run-backend` | Start backend with hot reload via Air on `:8080` |
| `make run-frontend` | Start frontend dev server via Vite on `:5173` |
| `make build-backend` | Compile the Go binary |
| `make build-frontend` | Production build of the frontend |
| `make test` | Run all tests (backend unit + frontend component) |
| `make lint` | Run all linters (golangci-lint + ESLint + TypeScript) |
| `make e2e` | Run Playwright E2E tests |

---

## Running the Tests

### Backend — unit tests

```bash
cd backend
go test ./... -race -count=1
```

Each domain module has `_test.go` files co-located with the source. Tests use fake in-memory repository implementations — no live database connection required.

### Frontend — component tests

```bash
cd frontend
npm run test
```

### E2E tests with Playwright

Requires the full application stack running locally.

```bash
# With the app already running:
make e2e

# Or directly:
cd e2e
npx playwright test

# Run in headed mode:
npx playwright test --headed

# View the HTML report:
npx playwright show-report
```

---

## Project Structure

```text
NeighborLink/
├── go.mod                      # Go module root (shared by the entire backend)
├── backend/
│   ├── cmd/server/             # Entry point — module wiring and server bootstrap
│   └── internal/
│       ├── auth/               # JWT-based registration and login (geocodes address on register)
│       ├── users/              # User profiles and avatar upload to Supabase Storage
│       ├── listings/           # Listings with PostGIS geolocation and photo upload
│       ├── transactions/       # Full rental lifecycle + Stripe payment and code validation flow
│       ├── messages/           # Per-transaction chat
│       ├── notifications/      # In-app notification system
│       ├── wallet/             # Points accumulation and cash redemption via Stripe Connect
│       └── platform/
│           ├── database/       # PostgreSQL connection pool (pgx/v5)
│           ├── stripe/         # Stripe client (AuthorizeDeposit, Capture, Release, Connect)
│           ├── geocoder/       # Nominatim (OpenStreetMap) HTTP client
│           ├── middleware/     # JWT auth middleware
│           └── adapters/       # Cross-module interface adapters
│
├── frontend/
│   └── src/
│       ├── components/         # Reusable UI components
│       ├── contexts/           # React contexts (auth)
│       ├── pages/              # Route-level views
│       ├── lib/                # API facade modules (one per domain)
│       └── types/              # Shared TypeScript domain types
│
├── e2e/                        # Playwright end-to-end tests
├── docs/                       # Technical documentation
│   ├── adr/                    # Architecture Decision Records
│   ├── getting-started.md
│   ├── payments.md
│   ├── monorepo.md
│   └── golang.md
│
├── .github/workflows/          # CI/CD pipelines
└── Makefile                    # Developer shortcuts
```

Each backend module follows the same layered structure:

```text
<module>/
├── domain.go              # Domain types and constants
├── repository.go          # Repository interface (port)
├── postgres_repository.go # PostgreSQL implementation (adapter)
├── service.go             # Business logic (where applicable)
├── handler.go             # HTTP handlers (Gin)
└── handler_test.go        # Unit tests with fake repository
```

---

## API Reference

All endpoints are prefixed with `/api`. Protected routes require an `Authorization: Bearer <token>` header.

### Auth

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/register` | No | Create a new user account (geocodes the address via Nominatim) |
| `POST` | `/api/auth/login` | No | Login and receive a JWT |

### Users

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/users` | No | List all users |
| `GET` | `/api/users/:id` | No | Get a user profile |
| `PUT` | `/api/users/me` | Yes | Update the authenticated user's profile |
| `POST` | `/api/users/me/avatar` | Yes | Upload avatar image |
| `GET` | `/api/users/me/points-history` | Yes | Get points transaction history |
| `POST` | `/api/users/me/redeem-points` | Yes | Redeem points for cash (minimum 1000 points) |

### Listings

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/listings` | No | List listings (filters: `category`, `status`, `deposit_min`, `deposit_max`, `exclude_owner_id`) |
| `GET` | `/api/listings/:id` | No | Get a single listing |
| `GET` | `/api/users/:id/listings` | No | List listings by owner |
| `POST` | `/api/listings` | Yes | Create a listing |
| `PUT` | `/api/listings/:id` | Yes | Update a listing (owner only) |
| `DELETE` | `/api/listings/:id` | Yes | Delete a listing (owner or admin; blocked if active transactions exist) |
| `POST` | `/api/listings/:id/photos` | Yes | Upload a listing photo (owner only) |

### Transactions

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/transactions` | No | List all transactions |
| `GET` | `/api/transactions/:id` | No | Get transaction details |
| `GET` | `/api/listings/:id/transactions` | No | List transactions for a listing |
| `GET` | `/api/users/:id/transactions` | No | List transactions for a user |
| `GET` | `/api/listings/:id/availability` | No | Get blocked date ranges for a listing |
| `POST` | `/api/listings/:id/reserve` | Yes | Reserve a listing for a date range (max 7 days) |
| `PUT` | `/api/transactions/:id/accept` | Yes (owner) | Accept a rental request |
| `PUT` | `/api/transactions/:id/reject` | Yes (owner) | Reject a rental request |
| `PUT` | `/api/transactions/:id/pay` | Yes (borrower) | Authorize Stripe deposit hold |
| `POST` | `/api/transactions/:id/generate-delivery-code` | Yes (borrower) | Generate one-time handover code |
| `POST` | `/api/transactions/:id/generate-return-code` | Yes (borrower) | Generate one-time return code |
| `POST` | `/api/transactions/:id/confirm-handover` | Yes (owner) | Validate handover code and capture deposit |
| `POST` | `/api/transactions/:id/confirm-return` | Yes (owner) | Validate return code and release deposit, award points |
| `POST` | `/api/transactions/:id/report-issue` | Yes (owner) | Open a dispute |
| `POST` | `/api/transactions/:id/resolve-dispute` | Yes (admin) | Close a dispute |
| `POST` | `/api/transactions/:id/refund-dispute` | Yes (admin) | Issue a points refund (percentage-based) |

### Messages

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/chats` | Yes | List active chats for the authenticated user |
| `GET` | `/api/transactions/:id/messages` | Yes | Get all messages for a transaction |
| `GET` | `/api/messages/:id` | Yes | Get a single message |
| `POST` | `/api/transactions/:id/messages` | Yes | Send a message in a transaction chat |
| `POST` | `/api/transactions/:id/decision` | Yes (owner) | Accept or reject a transaction from the chat (`accept` / `reject`) |

### Notifications

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/notifications` | Yes | List notifications for the authenticated user (supports `?limit=`) |
| `GET` | `/api/notifications/unread-count` | Yes | Get unread notification count |
| `PATCH` | `/api/notifications/:id/read` | Yes | Mark a notification as read |
| `PATCH` | `/api/notifications/read-all` | Yes | Mark all notifications as read |

### Reviews

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/transactions/:id/reviews` | No | List reviews for a transaction |
| `GET` | `/api/users/:id/reviews` | No | List reviews received by a user |
| `GET` | `/api/reviews/:id` | No | Get a single review |

### Health

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | No | Server health check |

---

## CI/CD

| Workflow | Trigger | What it does |
|---|---|---|
| `backend.yml` | Push / PR touching `backend/` or `go.mod` | `go vet` + `go test -race` + `go build` |
| `frontend.yml` | Push / PR touching `frontend/` | ESLint + TypeScript check + Vite build |
| `e2e.yml` | Manual dispatch | Playwright tests across Chromium, Firefox and WebKit |
| `codeql.yml` | Weekly schedule + Push / PR | Static security analysis for Go and JS/TS |

All checks must pass before a pull request can be merged into `main`.

---

## Contributing

### Branch naming

```bash
git checkout -b feat/short-description      # New feature
git checkout -b fix/short-description       # Bug fix
git checkout -b refactor/short-description  # Code improvement, no behaviour change
git checkout -b test/short-description      # Adding or fixing tests
git checkout -b docs/short-description      # Documentation only
```

### Commit convention

This project follows [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/):

```
<type>(<scope>): short imperative description

Examples:
feat(wallet): add points redemption modal
fix(transactions): correct deposit calculation on reserve
test(notifications): add handler unit tests
docs(readme): update local setup instructions
```

Valid types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `style`

### Pull Request workflow

1. Branch off `main` using the naming convention above
2. Keep commits focused and well-described
3. Open a PR with a clear title and description of **what** changed and **why**
4. All CI checks must pass before requesting a review
5. At least **one approval** is required to merge
6. Squash or rebase before merging to keep history clean

---

## Technical Documentation

| Document | Description |
|---|---|
| [`docs/getting-started.md`](./docs/getting-started.md) | Detailed setup and configuration guide |
| [`docs/payments.md`](./docs/payments.md) | Full Stripe deposit lifecycle and commission logic |
| [`docs/monorepo.md`](./docs/monorepo.md) | Rationale for the monorepo structure |
| [`docs/golang.md`](./docs/golang.md) | Go conventions and best practices used in this project |
| [`docs/adr/`](./docs/adr/) | Architecture Decision Records |

To add a new Architecture Decision Record:

```bash
cp docs/adr/000-template.md docs/adr/00X-your-decision-title.md
```
```
