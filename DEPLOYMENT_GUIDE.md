# SentinelScope – Deployment Guide (Platform-agnostic)

This guide covers local development and production deployment without relying on any specific hosting provider.

## Prerequisites

- Node.js 20+
- PostgreSQL database (e.g., Neon, Supabase, RDS)
- Stripe account (for subscriptions)
- Firebase project (for authentication)
- VirusTotal API key (optional features)

## Environment Variables

Copy `.env.example` to `.env` and set values:

- Required server
  - `DATABASE_URL`
  - `SESSION_SECRET`
  - `PUBLIC_BASE_URL` (e.g., http://localhost:3001 or your production domain)
  - `STRIPE_SECRET_KEY`
  - `VIRUSTOTAL_API_KEY` (optional)
  - `REAL_MONITORING_ALWAYS_ON` (optional, default true)
- Required client (Vite variables)
  - `VITE_STRIPE_PUBLIC_KEY`
  - `VITE_FIREBASE_API_KEY`
  - `VITE_FIREBASE_PROJECT_ID`
  - `VITE_FIREBASE_APP_ID`

## Local Development

1. Install dependencies
   - `npm install`
2. Configure env: copy `.env.example` → `.env` and fill values
3. Apply migrations (automated runner)
   - Run: `npm run db:migrate`
   - The runner applies numbered SQL files in `migrations/` exactly once, recording them in `sentinel_migrations`.
   - Idempotent: re-runs skip previously applied files (warn if file contents changed post-apply).
   - Files example: `0001_init.sql`, `0002_add_mfa_reset_and_compromised.sql`, `0003_add_flagged_only_default.sql`.
   - (Legacy `drizzle/` directory consolidated; avoid `npm run db:push` for these tables.)
   - Dry-run preview (no changes): `npm run db:migrate:dry-run`
   - List applied/pending: `npm run db:migrate:list`
    - JSON output (apply): `npm run db:migrate:json`
    - JSON output (list): `npm run db:migrate:list:json`
   - JSON pending-only (CI): `npm run db:migrate:pending:json`
   - Mark changed checksum (remediation): `MIGRATION=0003_add_flagged_only_default.sql npm run db:migrate:mark-changed`
   - Create template migration: `npm run db:migrate:new -- "add user_sessions table"`
    - Rollback (non-baseline): `MIGRATION=0003_add_flagged_only_default.sql npm run db:rollback`
    - Rollback with JSON: `MIGRATION=0003_add_flagged_only_default.sql npm run db:rollback:json`
       - Baseline (0001) rollback disabled; down files required (e.g., `0002_add_mfa_reset_and_compromised.down.sql`).
4. Run the app (server + client via Vite build served by Node)
   - `npm run dev` (or `PORT=3001 npm run dev`)

Default server port is 3001.

## Production Build & Run

1. Build
   - `npm run build`
2. Start
   - `npm start` (uses `NODE_ENV=production` and serves built client from `dist/public`)

### System service (PM2)

```bash
pm2 start dist/index.js --name sentinelscope
pm2 save
pm2 startup
```

### Docker (optional)

Create a Dockerfile and pass env via `--env-file .env`.

## Stripe Webhooks

For local testing use Stripe CLI:

```bash
stripe listen --forward-to http://localhost:3001/api/stripe/webhook
```

Set `STRIPE_SECRET_KEY` and `VITE_STRIPE_PUBLIC_KEY`. In production, set your webhook to `https://YOUR_DOMAIN/api/stripe/webhook`.

## Backups & Safety

- Use your database provider's automated backups and PITR (Point-in-time restore) if available
- Never commit real secrets—use `.env`
- Regularly run `npm outdated` and apply security updates

## Troubleshooting

- Database errors: verify `DATABASE_URL` and SSL settings with your provider
- Auth issues: ensure your domain is added to Firebase Authorized Domains
- Stripe: ensure webhook is pointing to `PUBLIC_BASE_URL/api/stripe/webhook`

## Monitoring

- Check server logs
- Admin dashboards within the app (System Analytics, Compliance)

## Security Checklist

- Secrets only in `.env`
- HTTPS in production (via reverse proxy/CDN)
- Strong `SESSION_SECRET`
- Restricted database credentials
- Regular dependency updates

## Audit Logging Reference

SentinelScope emits structured security & authentication audit logs into the `security_audit_logs` table. Admins can query them via:

```
GET /api/compliance/audit-logs?eventCategory=authentication&startDate=...&endDate=...
```

See `AUDIT_LOGGING.md` for the full taxonomy. Common categories:

- Authentication (`eventType=auth`, `eventCategory=authentication`): token & API key failures.
- Security (`eventType=api_key`, `eventCategory=security`): key rotations & forced expirations + IP blocklist enforcement.

Key action examples:
- `invalid_or_expired_token`: JWT verification failed.
- `api_key_invalid`: Provided key not recognized.
- `rotate`: Successful API key rotation (metadata includes grace window).
- `force_expire`: Grace window terminated early.
- `ip_blocked_source` / `ip_blocked_destination` / `ip_blocked_browsing`: Ingest rejected due to blocklisted IP.

Retention recommendation: 365 days (adjust per compliance requirements). Avoid storing secrets in `metadata`; only operational context.

## Dashboard Metrics & Trends

The Dashboard KPI strip consumes two endpoints:

1. `GET /api/stats` – point-in-time counts for:
    - `active`: Threats in detected (or mitigationStatus=detected in real monitoring)
    - `blocked`: Auto-blocked or explicitly blocked threats
    - `alerts`: Alerts created since local midnight

2. `GET /api/stats/history?hours=24&interval=hour` – time‑bucketed historical metrics used for trend percentages and sparklines.

### `/api/stats/history` Parameters

| Query Param | Type | Default | Notes |
|-------------|------|---------|-------|
| `hours` | integer | 24 | Window length back from now (max practical 168 for 7 days in hourly buckets). |
| `interval` | `hour` \| `day` | `hour` | Bucket granularity. Use `day` for multi‑day windows to reduce payload size. |

### Response Shape

```
[
   {
      "ts": "2025-11-13T13:00:00.000Z",
      "active": 12,
      "blocked": 4,
      "alerts": 3,
      "severityCritical": 1,
      "severityHigh": 2,
      "severityMedium": 5,
      "severityLow": 4
   },
   { "ts": "2025-11-13T14:00:00.000Z", "active": 15, "blocked": 5, "alerts": 6, "severityCritical": 0, "severityHigh": 1, "severityMedium": 3, "severityLow": 2 }
]
```

Each object is an aggregate for that bucket start time (`ts` ISO timestamp). Counts are derived differently depending on monitoring mode:

| Mode | Active Source | Blocked Source | Alerts Source | Severity Breakdown |
|------|----------------|----------------|---------------|-------------------|
| `demo` | `threats.status==='detected'` | `threats.blocked===true` | `alerts.timestamp` within bucket | Raw `threats.severity` counts per bucket |
| `real` | `threatEvents.mitigationStatus==='detected'` | `threatEvents.autoBlocked===true` | `alerts.timestamp` within bucket | (Placeholder zeros currently; future: `threatEvents.severity`) |

### Usage Guidelines

- For trend arrows, compare last bucket vs previous bucket: `(last - prev) / prev * 100` (guard for `prev=0`).
- For longer ranges ( >48h ) switch to `interval=day` to avoid large arrays.
- Client should treat missing or empty history as neutral trend (display `—`).
- Recommended caching: 30–60s per user (low volatility) to reduce DB load.
- This endpoint is authenticated; include a valid Bearer token (or legacy header in development).

### Future Enhancements

- Rolling averages (7-day) for smoothing.
- Additional dimensions (blocked ratio) per bucket.
- Populate real-mode severity breakdown (currently placeholder zeros).
- Anomaly flag if current bucket deviates >3σ from trailing mean.

## CI Labels & Migration Governance

GitHub Actions workflow enforces two governance labels:

| Label | Purpose | CI Effect |
|-------|---------|-----------|
| `allow-migration-checksum-update` | Approve updating checksum of an already applied migration (non‑schema edits: comments/whitespace). | Skips checksum drift failure; changed applied migration otherwise fails. |
| `allow-rollback` | Approve modifying or adding `*.down.sql` rollback files. | Skips rollback guard; down file changes otherwise fail. |

### Usage Scenarios

1. Minor formatting tweak to applied migration: add `allow-migration-checksum-update`, then run `MIGRATION=000X_name.sql npm run db:migrate:mark-changed`.
2. Introducing rollback for a non-baseline migration: add `allow-rollback` and create `000X_name.down.sql`.

Baseline (`0001_init.sql`) remains forward-only; never roll it back.

### Guards Summary

- Early pending gate fails fast if unapplied migrations exist.
- Drift detection prevents silent alteration of production history.
- Rollback guard stops accidental destructive changes to down files.
- JSON outputs (`db:migrate:json`, `db:migrate:pending:json`) support machine parsing in CI.

Cross-platform pipeline examples: see `CI_GUIDE.md`.

## Startup Schema Checks

On server launch SentinelScope now validates the presence of critical columns added by recent migrations:

- `user_mfa.mfa_last_reset_at`
- `webauthn_credentials.compromised`

If any are missing the server aborts startup with a clear error directing you to run `npm run db:migrate`.

### Skipping (Emergency Only)

Set `SKIP_SCHEMA_CHECKS=true` to bypass the validation (e.g., during a temporary migration outage). This is NOT recommended for normal operation because affected endpoints may throw 500 errors until migrations are applied.

Example:

```
SKIP_SCHEMA_CHECKS=true npm run dev
```

Remove the flag once migrations are applied to restore protective preflight.

