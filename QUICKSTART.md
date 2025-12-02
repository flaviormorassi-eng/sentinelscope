# SentinelScope Quickstart (Local)

The fastest way to run SentinelScope locally is with Docker. You’ll get the API + UI and a local Postgres database with one command.

## Requirements

- Docker Desktop (macOS/Windows) or Docker Engine + docker compose (Linux)

## One-command start

### macOS / Linux

```bash
# From the project root
bash ./scripts/quickstart.sh
```

### Windows (PowerShell)

```powershell
# From the project root
npm run quickstart:win
```

This will:
- Build and start the stack via Docker Compose
- Wait for the app to become healthy
- On macOS/Windows, open a dev quick-login URL in your browser

Open in your browser:
- App: http://localhost:3001/
- Dev quick-login: http://localhost:3001/dev/login/demo

Note: The stack runs in production mode inside Docker, but with developer-friendly defaults:
- REAL_MONITORING_ALWAYS_ON=true
- ALLOW_LEGACY_X_USER_ID=true (for quick-login)
- DISABLE_RATE_LIMIT=1

You can change these in `docker-compose.yml`.

## Manage the stack

```bash
npm run docker:logs   # follow app logs
npm run docker:down   # stop and remove containers
```

## First steps in the app

1) Click the dev quick-login link (or browse to `/dev/login/demo`).
2) Go to Settings → switch Monitoring Mode to Real (auto-provisions an event source).
3) Visit Event Sources to see the auto-provisioned "Dev Agent".
4) Visit Security Center (sidebar) to see Alerts and the Threat Log in tabs. Use the "Generate sample flow" button on Network Activity to seed flows if needed.

### No event source yet? Create one automatically

You can create a sample source and ingest a couple of events with one command (requires the server to be running locally):

```bash
npm run dev:provision
```

This will:
- Create a "Dev Agent" event source (saved to `./.local/dev-source.json`)
- Ingest two sample events so the Threats page has data to work with

If you prefer manual steps, see the “API key rotation quick test” section below for curl commands to create a source and ingest events.

## Non-Docker (optional)

If you prefer to run without Docker:

```bash
npm ci
npm run build
PORT=3001 NODE_ENV=production JWT_SECRET=devsecret REAL_MONITORING_ALWAYS_ON=true npm start
```

You’ll need a Postgres database and to set `DATABASE_URL`. The Docker Compose file shows a working example.

## Troubleshooting

- Port in use (3001): Stop any process using the port: `lsof -tiTCP:3001 -sTCP:LISTEN | xargs kill -9`
- App not healthy: Check logs: `npm run docker:logs`
- Database issues: The compose file waits for Postgres health. If it still fails, try `npm run docker:down` then `npm run docker:up` again.

## API key rotation quick test (optional)

You can exercise event-source key rotation end-to-end with curl (zsh):

```bash
# 1) Start dev locally (or use Docker quickstart in the section above)
npm run dev:local

# 2) Create an event source (saves plaintext apiKey)
curl -fsS -H 'x-user-id: demo' \
	-H 'Content-Type: application/json' \
	-d '{"name":"Test Agent","sourceType":"agent","description":"Rotation test"}' \
	http://localhost:3001/api/event-sources | tee ./.local/event-source.json

# Show ID and key
echo ID: $(jq -r '.id' ./.local/event-source.json)
echo KEY: $(jq -r '.apiKey' ./.local/event-source.json)

# 3) Ingest once with the original key
OLD_KEY=$(jq -r '.apiKey' ./.local/event-source.json)
curl -fsSi -X POST http://localhost:3001/api/ingest/events \
	-H "x-api-key: $OLD_KEY" -H "Content-Type: application/json" \
	-d '{"rawData":{"event":"pre-rotation-ok"}}'

# 4) Rotate with a grace window (e.g., 120s) and capture the new key
SID=$(jq -r '.id' ./.local/event-source.json)
curl -fsS -X POST -H 'x-user-id: demo' -H 'Content-Type: application/json' \
	-d '{"graceSeconds":120}' \
	"http://localhost:3001/api/event-sources/$SID/rotate" | tee ./.local/rotation.json

NEW_KEY=$(jq -r '.apiKey' ./.local/rotation.json)
echo NEW_KEY: $NEW_KEY

# 5) During the grace window, both keys should be accepted (new key always works)
curl -fsSi -X POST http://localhost:3001/api/ingest/events \
	-H "x-api-key: $OLD_KEY" -H "Content-Type: application/json" \
	-d '{"rawData":{"event":"old-key-within-grace"}}'

curl -fsSi -X POST http://localhost:3001/api/ingest/events \
	-H "x-api-key: $NEW_KEY" -H "Content-Type: application/json" \
	-d '{"rawData":{"event":"new-key-ok"}}'

# 6) Force-expire rotation (optional) to end grace immediately
curl -fsSi -X POST -H 'x-user-id: demo' \
	"http://localhost:3001/api/event-sources/$SID/rotation/expire"

# After expiry: old key should fail; new key should succeed
curl -fsSi -X POST http://localhost:3001/api/ingest/events \
	-H "x-api-key: $OLD_KEY" -H "Content-Type: application/json" \
	-d '{"rawData":{"event":"old-key-should-fail"}}'

curl -fsSi -X POST http://localhost:3001/api/ingest/events \
	-H "x-api-key: $NEW_KEY" -H "Content-Type: application/json" \
	-d '{"rawData":{"event":"new-key-still-ok"}}'
```

Notes:
- If you see a connection error, make sure the server is running (keep `npm run dev:local` open) and `curl -fsS http://localhost:3001/healthz` returns JSON.
- In zsh, environment variables use `=` (e.g., `PORT=3001 npm run dev`), not `:`.
- For detailed server-side decision logging during verification, start the server with `KEY_ROTATION_DEBUG=1`.

## Automated rotation smoke test

Instead of manual curl steps you can run the scripted check:

```bash
# Server must be running locally (e.g., npm run dev:local) on http://localhost:3001
npm run rotation:test
```

The script will:
- Create a temporary event source
- Ingest pre-rotation (expects 201)
- Rotate with a grace window (default 90s) and capture new key
- Ingest with OLD and NEW keys during grace (both expect 201)
- Force-expire rotation and verify OLD key now fails while NEW succeeds
- Print a PASS/FAIL summary and exit non-zero if any expectation fails

Environment overrides:

```bash
GRACE_SECONDS=120 BASE_URL=http://localhost:3001 npm run rotation:test
```

To see internal decision logs while it runs, start your server with:

```bash
KEY_ROTATION_DEBUG=1 npm run dev:local
```
