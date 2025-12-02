#!/usr/bin/env bash
set -euo pipefail
# pg-reset.sh: Safely reset local Postgres dev database (Homebrew or Docker)
# WARNING: This DROPS all data in 'sentinelscope'. Use only for local dev.
# Steps:
#  1. Detect running Postgres
#  2. Drop + recreate DB and user sentinel (if needed)
#  3. Run migrations
#  4. (Optional) Seed
# Usage:
#  bash scripts/pg-reset.sh            # reset + migrate
#  SEED=1 bash scripts/pg-reset.sh     # reset + migrate + minimal seed

DB_NAME="sentinelscope"
DB_USER="sentinel"
DB_PASS="sentinel"
PORT_DOCKER=5433
PORT_LOCAL=5432

info() { echo -e "\e[34m[pg-reset]\e[0m $*"; }
warn() { echo -e "\e[33m[pg-reset]\e[0m $*"; }
err()  { echo -e "\e[31m[pg-reset]\e[0m $*"; }

# Detect docker postgres
if command -v docker >/dev/null 2>&1 && docker compose ps db >/dev/null 2>&1; then
  if docker compose ps db | grep -qi 'running'; then
    info "Docker Postgres detected (port ${PORT_DOCKER})."
    export DATABASE_URL="postgres://${DB_USER}:${DB_PASS}@localhost:${PORT_DOCKER}/${DB_NAME}"
    USING_DOCKER=1
  fi
fi

if [ -z "${USING_DOCKER:-}" ]; then
  info "Using local Postgres (expected on ${PORT_LOCAL})."
  export DATABASE_URL="postgres://${DB_USER}:${DB_PASS}@localhost:${PORT_LOCAL}/${DB_NAME}"
fi

# Ensure psql available
if ! command -v psql >/dev/null 2>&1; then
  err "psql not found. Install Postgres (brew install postgresql@16) first."; exit 1
fi

info "Attempting to drop database ${DB_NAME} (ignore errors if absent)"
psql postgres -c "DROP DATABASE IF EXISTS ${DB_NAME};" || warn "Drop DB failed (likely absent)"
info "Dropping user ${DB_USER} if exists"
psql postgres -c "DROP ROLE IF EXISTS ${DB_USER};" || warn "Drop role failed"
info "Creating user ${DB_USER}"
psql postgres -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';"
info "Creating database ${DB_NAME} owned by ${DB_USER}"
psql postgres -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"
info "Grant privileges"
psql postgres -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};"

info "Running migrations..."
npm run db:migrate

if [ "${SEED:-}" = "1" ]; then
  info "SEED flag detected. Attempting automatic seed after reset."
  if [ -z "${USER_ID:-}" ]; then
    warn "USER_ID env var not set; cannot seed automatically. Export USER_ID then re-run with SEED=1."
  else
    # Check if server already listening on PORT (default 3001)
    PORT_CHECK=${PORT:-3001}
    if nc -z localhost "$PORT_CHECK" 2>/dev/null; then
      info "Server detected on port $PORT_CHECK. Executing seed request."
      curl -s -X POST -H "x-user-id: ${USER_ID}" -H 'Content-Type: application/json' \
        -d "{\"threatRawCount\":${SEED_RAW_COUNT:-8},\"browsingCount\":${SEED_BROWSING_COUNT:-10},\"includeAlerts\":true}" \
        http://localhost:${PORT_CHECK}/api/dev/seed | jq . || warn "Seed request failed." 
    else
      warn "Server not running (port $PORT_CHECK). Start with 'npm run dev' then seed manually:"
      echo "curl -s -X POST -H 'x-user-id: ${USER_ID}' -H 'Content-Type: application/json' -d '{\"threatRawCount\":8,\"browsingCount\":10,\"includeAlerts\":true}' http://localhost:${PORT_CHECK}/api/dev/seed | jq ."
    fi
  fi
fi

info "Reset complete. Start dev server: npm run dev"
info "Example seed after startup:"
echo "curl -s -X POST -H 'x-user-id: YOUR_USER_ID' -H 'Content-Type: application/json' \
  -d '{\"threatRawCount\":6,\"browsingCount\":8,\"includeAlerts\":true}' \
  http://localhost:3001/api/dev/seed | jq ."
