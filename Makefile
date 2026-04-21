# Carga .env automáticamente si existe
ifneq (,$(wildcard .env))
  include .env
  export
endif
.PHONY: install run-backend run-frontend build-backend build-frontend test lint e2e

## Install all dependencies
install:
	go install github.com/air-verse/air@latest
	curl -sSfL https://raw.githubusercontent.com/golangci/golangci-lint/HEAD/install.sh | sh -s -- -b $$(go env GOPATH)/bin
	go mod download
	cd frontend && npm ci
	cd e2e && npm ci

## Run backend with hot reload
run-backend:
ifeq ($(OS),Windows_NT)
	$(shell go env GOPATH)/bin/air -c backend/.air.toml --build.bin "./tmp/server.exe" --build.cmd "go build -o ./tmp/server.exe ./backend/cmd/server"
else
	$(shell go env GOPATH)/bin/air -c backend/.air.toml
endif
## Run frontend dev server
run-frontend:
	cd frontend && npm run dev

## Build backend binary
build-backend:
	go build -o backend/bin/server ./backend/cmd/server

## Build frontend for production
build-frontend:
	cd frontend && npm run build

## Run all tests
test:
	go test -v -race ./...
	cd frontend && npm run test

## Run linters
lint:
	$(shell go env GOPATH)/bin/golangci-lint run
	cd frontend && npm run lint

## Run E2E tests (requires backend + frontend running)
e2e:
	cd e2e && npx playwright test
