#!/usr/bin/env bash
set -euo pipefail

# Provision a sample event source and ingest a couple of events
# Requirements: curl, jq; Server running at $BASE_URL (default http://localhost:3001)

BASE_URL=${BASE_URL:-http://localhost:3001}
USER_ID=${USER_ID:-demo}
OUT_DIR=${OUT_DIR:-./.local}
mkdir -p "$OUT_DIR"

need() { command -v "$1" >/dev/null 2>&1 || { echo "ERROR: '$1' is required" >&2; exit 1; }; }
need curl
need jq

say() { echo "[dev-provision] $*"; }

TMP=$(mktemp)
trap 'rm -f "$TMP"' EXIT

# Health check
say "Checking server health at $BASE_URL/healthz"
curl -fsS "$BASE_URL/healthz" >/dev/null || { echo "Server not healthy. Start it first (npm run dev:local)." >&2; exit 1; }

# Create source
say "Creating sample event source (user: $USER_ID)"
HTTP=$(curl -sS -o "$TMP" -w "%{http_code}" \
  -H "x-user-id: $USER_ID" -H "Content-Type: application/json" \
  -d '{"name":"Dev Agent","sourceType":"agent","description":"Sample source for testing"}' \
  "$BASE_URL/api/event-sources")
if [[ "$HTTP" != "200" ]]; then
  echo "Create source failed: HTTP $HTTP" >&2
  cat "$TMP" >&2
  exit 1
fi
cp "$TMP" "$OUT_DIR/dev-source.json"
SID=$(jq -r '.id' "$TMP")
KEY=$(jq -r '.apiKey' "$TMP")
say "Created source: $SID"
say "Saved details to $OUT_DIR/dev-source.json"

# Ingest two sample events
for evt in "hello-world" "second-event"; do
  say "Ingesting $evt"
  HTTP=$(curl -sS -o "$TMP" -w "%{http_code}" \
    -X POST "$BASE_URL/api/ingest/events" \
    -H "x-api-key: $KEY" -H "Content-Type: application/json" \
    -d "{\"rawData\":{\"event\":\"$evt\"}}")
  if [[ "$HTTP" != "201" ]]; then
    echo "Ingest failed ($evt): HTTP $HTTP" >&2
    cat "$TMP" >&2
    exit 1
  fi
  jq -r '.' "$TMP" | sed 's/^/[ingest] /'
done

say "Done. You can now view the source in /event-sources and threats in /threats."
