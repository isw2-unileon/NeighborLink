
# NeighborLink

### Concepto del Proyecto

NeighborLink es una plataforma de economía colaborativa para el préstamo y alquiler de objetos de uso puntual entre personas cercanas. El objetivo es crear un inventario comunitario que permita a los usuarios ahorrar dinero y espacio, ofreciendo un sistema seguro para monetizar herramientas o recursos que no utilizan frecuentemente.

### Funcionalidad Principal

* **Geolocalización:** Localización de recursos y anuncios en un radio cercano (menos de 500 metros) utilizando un motor de alta eficiencia.
* **Sistema de Seguridad y Fianzas:** Gestión de retenciones bancarias para proteger al propietario ante daños o robos.
* **Validación por QR:** Uso de códigos QR dinámicos para confirmar legalmente la entrega y la devolución del objeto.
* **Chat Integrado:** Comunicación en tiempo real entre vecinos para coordinar los intercambios.
* **Incentivos:** Los prestadores reciben un 5% del valor de la fianza y puntos de reputación dentro de la plataforma.

### Stack Tecnológico

* **Backend:** Go (Golang) para el motor de matching y geolocalización.
* **Base de Datos:** Supabase con extensión PostGIS para gestión de coordenadas.
* **Comunicación:** Supabase Realtime para el sistema de chat.
*  **Pagos:** Sistema de pagos usando la plataforma de Stripe para utilizarla como plataforma y programar retenciones y devoluciones.


# Monorepo Template: Go + React/Vite

A monorepo template for full-stack applications with a **Go** backend and a **React + TypeScript + Vite** frontend.

## Project Structure

```text
├── backend/              Go API server (Gin)
│   ├── cmd/server/       Entry point
│   └── internal/config/  Environment config
│
├── frontend/             React + TypeScript + Vite + Tailwind
│   └── src/
│
├── e2e/                  Playwright E2E tests
├── .github/workflows/    CI/CD pipelines
└── Makefile              Dev commands
```

## Prerequisites

- [Go](https://go.dev/dl/) 1.24+
- [Node.js](https://nodejs.org/) 22+

## Getting Started

```bash
make install

# Terminal 1
make run-backend    # port 8080

# Terminal 2
make run-frontend   # port 5173
```

The Vite dev server proxies `/api` requests to the backend.

## Commands

| Command              | Description                     |
|----------------------|---------------------------------|
| `make install`       | Install all dependencies        |
| `make run-backend`   | Backend with hot reload (Air)   |
| `make run-frontend`  | Frontend dev server (Vite)      |
| `make test`          | Run all tests                   |
| `make lint`          | Run all linters                 |
| `make e2e`           | Run Playwright E2E tests        |

## API

| Method | Path         | Description    |
|--------|------------- |----------------|
| `GET`  | `/health`    | Health check   |
| `GET`  | `/api/hello` | Sample endpoint|
