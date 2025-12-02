#!/usr/bin/env bash
set -euo pipefail

# Auto dev bootstrap: prefer Docker Postgres; fallback to Homebrew Postgres instructions.

echo "[dev-auto] Checking for docker..."
if command -v docker >/dev/null 2>&1; then
  echo "[dev-auto] Docker found. Using docker-compose Postgres on port 5433."
  if [ ! -f .env ]; then
    echo "[dev-auto] Copying .env.local.postgres to .env";
    cp .env.local.postgres .env
  fi
  # Ensure port matches docker compose mapping (5433->5432)
  if ! grep -q '5433' .env; then
    echo "[dev-auto] NOTE: .env does not reference port 5433; adjusting DATABASE_URL temporarily.";
    export DATABASE_URL="postgres://sentinel:sentinel@localhost:5433/sentinelscope"
  fi
  docker compose up -d db
  echo "[dev-auto] Waiting for Postgres to be ready (5s)..."
  sleep 5
  echo "[dev-auto] Running migrations..."
  npm run db:migrate || { echo "[dev-auto] Migrations failed"; exit 1; }
  echo "[dev-auto] Starting dev server..."
  npm run dev
  exit 0
fi

# Fallback path: Docker absent
cat <<'EOF'
[dev-auto] Docker not found. Fallback to local Postgres via Homebrew.

Install & start Postgres 16:
  brew update
  brew install postgresql@16
  brew services start postgresql@16

Initial DB/user setup:
  createdb sentinelscope
  psql -d sentinelscope -c "CREATE USER sentinel WITH PASSWORD 'sentinel';"
  psql -d sentinelscope -c "GRANT ALL PRIVILEGES ON DATABASE sentinelscope TO sentinel;"

Set env (bash/zsh):
  export DATABASE_URL=postgres://sentinel:sentinel@localhost:5432/sentinelscope

Run migrations:
  npm run db:migrate

Start dev server:
  npm run dev

If you prefer skipping schema checks temporarily (not recommended):
  SKIP_SCHEMA_CHECKS=true npm run dev

Re-run seed endpoint after startup:
  curl -s -X POST -H 'x-user-id: YOUR_USER_ID' -H 'Content-Type: application/json' \
    -d '{"threatRawCount":8,"browsingCount":10,"excludeSeverities":["high","critical"],"simulateAgingHours":48,"onlyNew":true}' \
    http://localhost:3001/api/dev/seed | jq .
EOF
exit 0
