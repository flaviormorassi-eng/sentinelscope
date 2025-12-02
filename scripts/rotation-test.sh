#!/usr/bin/env bash
set -euo pipefail

# Simple rotation smoke test against a running local server
# Requirements: curl, jq; Server should be running on $BASE_URL (default http://localhost:3001)

BASE_URL=${BASE_URL:-http://localhost:3001}
USER_ID_HEADER=${USER_ID_HEADER:-demo}
GRACE_SECONDS=${GRACE_SECONDS:-90}

need() { command -v "$1" >/dev/null 2>&1 || { echo "ERROR: '$1' is required" >&2; exit 1; }; }
need curl
need jq

PASS=()
FAIL=()

section() { echo; echo "=== $* ==="; }

get_health() {
  curl -fsS "$BASE_URL/healthz" | jq -r '.env + ":" + ( .ok | tostring )'
}

post_json() {
  local url="$1"; shift
  local data="$1"; shift
  local headers=("-H" "Content-Type: application/json")
  if [[ "$url" == *"/api/event-sources"* ]] || [[ "$url" == *"/rotate"* ]] || [[ "$url" == *"/rotation/expire"* ]]; then
    headers+=("-H" "x-user-id: $USER_ID_HEADER")
  fi
  curl -sS -o "$TMP_BODY" -w "%{http_code}" -X POST "$url" "${headers[@]}" -d "$data"
}

post_ingest() {
  local key="$1"; shift
  local evt="$1"; shift
  curl -sS -o "$TMP_BODY" -w "%{http_code}" \
    -X POST "$BASE_URL/api/ingest/events" \
    -H "x-api-key: $key" -H "Content-Type: application/json" \
    -d "{\"rawData\":{\"event\":\"$evt\"}}"
}

assert_code() {
  local got="$1"; shift
  local want="$1"; shift
  local label="$1"; shift
  if [[ "$got" == "$want" ]]; then
    echo "PASS $label ($got)" && PASS+=("$label")
  else
    echo "FAIL $label (got $got, want $want)" && FAIL+=("$label")
  fi
}

TMP_BODY=$(mktemp)
trap 'rm -f "$TMP_BODY"' EXIT

section "Health check"
if ENV_OK=$(get_health); then
  echo "Server healthy: $ENV_OK"
else
  echo "ERROR: Server not healthy at $BASE_URL; start it first (npm run dev)" >&2
  exit 1
fi

section "Create event source"
CREATE_CODE=$(post_json "$BASE_URL/api/event-sources" "{\"name\":\"Rotation Test Agent\",\"sourceType\":\"agent\",\"description\":\"Rotation smoke test\"}")
echo "Status: $CREATE_CODE"; cat "$TMP_BODY"; echo
assert_code "$CREATE_CODE" 200 "create-source"
SID=$(jq -r '.id' "$TMP_BODY")
OLD=$(jq -r '.apiKey' "$TMP_BODY")

section "Pre-rotation ingest with OLD"
PRE_CODE=$(post_ingest "$OLD" "pre-rotation")
echo "Status: $PRE_CODE"; cat "$TMP_BODY"; echo
assert_code "$PRE_CODE" 201 "ingest-pre-rotation"

section "Rotate with ${GRACE_SECONDS}s grace"
ROT_CODE=$(post_json "$BASE_URL/api/event-sources/$SID/rotate" "{\"graceSeconds\":$GRACE_SECONDS}")
echo "Status: $ROT_CODE"; cat "$TMP_BODY"; echo
assert_code "$ROT_CODE" 200 "rotate-start"
NEW=$(jq -r '.apiKey' "$TMP_BODY")
EXPIRES_AT=$(jq -r '.rotationExpiresAt' "$TMP_BODY")

section "Try OLD within grace"
OLD_CODE=$(post_ingest "$OLD" "old-within-grace")
echo "Status: $OLD_CODE"; cat "$TMP_BODY"; echo
assert_code "$OLD_CODE" 201 "ingest-old-within-grace"

section "Try NEW within grace"
NEW_CODE=$(post_ingest "$NEW" "new-within-grace")
echo "Status: $NEW_CODE"; cat "$TMP_BODY"; echo
assert_code "$NEW_CODE" 201 "ingest-new-within-grace"

section "Force expire rotation and try OLD (should fail)"
EXP_CODE=$(post_json "$BASE_URL/api/event-sources/$SID/rotation/expire" "{}")
echo "Status: $EXP_CODE"; cat "$TMP_BODY"; echo
assert_code "$EXP_CODE" 200 "rotation-force-expire"
OLD_FAIL_CODE=$(post_ingest "$OLD" "old-after-expire")
echo "Status: $OLD_FAIL_CODE"; cat "$TMP_BODY"; echo
# Some implementations return 401; accept 401 or 403 for failure
if [[ "$OLD_FAIL_CODE" == 401 || "$OLD_FAIL_CODE" == 403 ]]; then
  echo "PASS ingest-old-after-expire ($OLD_FAIL_CODE)" && PASS+=("ingest-old-after-expire")
else
  echo "FAIL ingest-old-after-expire (got $OLD_FAIL_CODE, want 401/403)" && FAIL+=("ingest-old-after-expire")
fi

section "Summary"
echo "Expires at: $EXPIRES_AT"
echo "PASS: ${#PASS[@]} -> ${PASS[*]:-}"
echo "FAIL: ${#FAIL[@]} -> ${FAIL[*]:-}"

# Return non-zero if any failures
if [[ ${#FAIL[@]} -gt 0 ]]; then
  exit 1
fi
