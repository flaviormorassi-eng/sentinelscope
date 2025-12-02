# SentinelScope Makefile for streamlined local development

# Default target: show help
.PHONY: help
help:
	@echo "Available targets:"
	@echo "  pg-dev       Copy Postgres env, start db container, migrate, start dev app"
	@echo "  pg-db        Start only the Postgres Docker container"
	@echo "  migrate      Run database migrations against current .env"
	@echo "  seed         Seed dev data via API dev seed endpoint (requires server running)"
	@echo "  down         Stop Docker services"

.PHONY: pg-db
pg-db:
	docker compose up -d db

.PHONY: migrate
migrate:
	npm run db:migrate

.PHONY: pg-dev
pg-dev:
	cp .env.local.postgres .env.local
	docker compose up -d db
	npm run db:migrate
	npm run dev

.PHONY: seed
seed:
	curl -s -X POST -H 'x-user-id: $$USER_ID' -H 'Content-Type: application/json' \
	  -d '{"threatRawCount":8,"browsingCount":10,"includeAlerts":true}' \
	  http://localhost:3001/api/dev/seed | jq . || echo "Server not running or seed failed"

.PHONY: down
down:
	docker compose down
