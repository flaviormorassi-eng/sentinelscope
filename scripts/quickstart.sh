#!/usr/bin/env bash
set -euo pipefail

# Quickstart script for SentinelScope (Docker)
# Requirements: Docker Desktop or Docker Engine + docker compose plugin

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

command -v docker >/dev/null 2>&1 || {
  echo "Docker is required. Please install Docker Desktop: https://docs.docker.com/get-docker/" >&2
  exit 1
}

# Use compose v2 syntax `docker compose` if available, else fallback to `docker-compose`
if docker compose version >/dev/null 2>&1; then
  DCMD=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  DCMD=(docker-compose)
else
  echo "docker compose (v2) or docker-compose is required." >&2
  exit 1
fi

# Build and start in background
"${DCMD[@]}" up -d --build

# Wait for app health if curl available
APP_URL=${PUBLIC_BASE_URL:-http://localhost:3001}
HEALTH_URL="$APP_URL/healthz"
if command -v curl >/dev/null 2>&1; then
  echo "Waiting for app to become healthy at $HEALTH_URL ..."
  for i in {1..30}; do
    if curl -fsS "$HEALTH_URL" >/dev/null; then
      echo "App is healthy."
      break
    fi
    sleep 2
  done
fi

# Print next steps
cat <<'EOS'

SentinelScope is starting in Docker.

Open your browser:
  - App:            http://localhost:3001/
  - Dev quick-login: http://localhost:3001/dev/login/demo

Tips:
  - Event Sources will auto-provision when switching to Real monitoring in Settings.
  - Threats/Network Flow will populate as the agent sends data or via the sample generator.

Manage:
  - View logs:   docker compose logs -f app
  - Stop stack:  docker compose down
EOS

# On macOS, auto-open dev login to simplify first-run
if [[ "$(uname)" == "Darwin" ]]; then
  command -v open >/dev/null 2>&1 && open "http://localhost:3001/dev/login/demo" || true
fi
