# SentinelScope – AI Coding Assistant Instructions

> Audience: AI pair programmers (Copilot Agents, etc.) working in this repo. Keep responses concise and reflect project conventions. Avoid generic advice; anchor to actual patterns here.

## 1. Architecture Snapshot
- **Stack**: Express (Node ESM) + React (Vite) + Tailwind + Drizzle ORM (Postgres/Neon) + Stripe + MFA (TOTP & WebAuthn) + VirusTotal optional.
- **Entry point**: `server/index.ts` boots Express, runs `runStartupChecks()` (schema guard), registers routes via `registerRoutes()`, then conditionally sets up Vite dev middleware or static serving.
- **Data layer**: `DbStorage` in `server/storage.ts` implements a large interface (users, threats, alerts, events, audit logs, subscriptions, MFA, browsing activity). Uses Drizzle with Neon WebSocket (`neonConfig.webSocketConstructor = ws`). Reference existing methods before adding new ones.
- **Event flow (Real Monitoring)**: Raw events (`rawEvents`) → periodic processor (`server/eventProcessor.ts`) → normalization → threat detection mock → alerts + threat_events. Processor runs every 5 min; add new detection logic inside `processRawEvent()`.
- **Modes**: User preference `monitoringMode` (`demo` vs `real`). Switching to `real` auto‑provisions a "Dev Agent" + seeds sample normalized + threat events (see `/api/user/preferences` PUT logic).

## 2. Auth & Security Patterns
- **Primary auth**: JWT Bearer (secret `JWT_SECRET`). Dev fallback allows legacy `x-user-id` header + cookie when `ALLOW_LEGACY_X_USER_ID=true`.
- **Middleware**: `authenticateUser` (strict) vs `optionalAuth`. Admin endpoints wrap with `requireAdmin` (see `server/middleware/adminAuth.ts`). MFA freshness enforced via `requireMfaFresh`.
- **Audit logging**: Failures in `authenticateUser` call `createSecurityAuditLog` with action codes (`missing_token`, `invalid_or_expired_token`, etc.). Taxonomy documented in `AUDIT_LOGGING.md`.
- **Startup schema checks**: Abort if critical columns missing (recent migrations). Bypass only with `SKIP_SCHEMA_CHECKS=true` (emergency).
- **Rate limiting & headers**: Helmet everywhere; `/api` rate‑limited unless `DISABLE_RATE_LIMIT=true` in dev.

## 3. Migrations & DB Governance
- **Canonical migration directory**: `migrations/` numbered `000X_description.sql` (+ optional `*.down.sql`). Baseline `0001_init.sql` is forward‑only.
- **Scripts** (see `package.json`):
  - Apply: `npm run db:migrate` (respect DRY_RUN, JSON flags).
  - List: `npm run db:migrate:list` / JSON variant.
  - Pending (CI gate): `npm run db:migrate:pending:json`.
  - New: `npm run db:migrate:new -- "add foo table"`.
  - Mark changed applied migration: `MIGRATION=000X_name.sql npm run db:migrate:mark-changed`.
  - Rollback (non‑baseline): `MIGRATION=000X_name.sql npm run db:rollback`.
- **CI labels**: `allow-migration-checksum-update`, `allow-rollback` (see `CI_GUIDE.md`). Do not alter applied migration content without the proper label + mark‑changed script.

## 4. Ingestion & Key Rotation
- **Event ingestion endpoints**: `POST /api/ingest/events` & `/api/browsing/ingest` expect `x-api-key` linked to an event source (`eventSources` table). Use `storage.verifyEventSourceApiKey()`.
- **Auto provision**: First switch to real mode seeds a Dev Agent + events.
- **Rotation flow**: `POST /api/event-sources/:id/rotate` creates grace window (old + new key valid). Expiry cleanup runs every 10 min in `index.ts` (`cleanupExpiredRotations`). Force expire endpoint terminates grace early. Test end‑to‑end with `npm run rotation:test` or manual curl in `QUICKSTART.md`.

## 5. Stats & Dashboard Data
- KPI endpoints: `/api/stats` (point-in-time) and `/api/stats/history?hours=24&interval=hour` for trend buckets (see `DEPLOYMENT_GUIDE.md`). Client compares last vs previous bucket for trend arrows. Real vs demo uses different underlying tables (`threatEvents` vs `threats`). When extending stats add fields to `storage.getStatsHistory()`.

## 6. Client Conventions
- **Routing**: `wouter` in `client/src/App.tsx` with `<ProtectedRoute>` wrapper. Redirect patterns (e.g., `/threats` → `/security-center?tab=threats`).
- **State/data**: React Query via `queryClient` in `lib/queryClient`. Prefer hooks in `hooks/` or `contexts/` for shared logic.
- **UI library**: Radix primitives + local shadcn-style components in `client/src/components/ui/`. Follow existing prop + variant patterns (e.g., `Badge`, `ThemeToggle`).
- **Internationalization**: `i18n/` initializes `react-i18next`. Provide keys, avoid hard-coded user‑visible strings.
- **MFA challenge**: Global bus `lib/mfaBus` triggers `<MfaChallenge />` modal.

## 7. Testing & Local Workflows
- **Unit/integration tests**: Vitest (`npm test`). Coverage: `npm run test:coverage` then `npm run coverage:badge` to refresh `coverage-badge.svg`.
- **Dev server**: `npm run dev` (tsx + dotenv). Optional quick local bootstrap: `npm run dev:local` sets permissive dev flags.
- **Docker quickstart**: `scripts/quickstart.sh` builds+starts stack, opens quick-login. Stop with `npm run docker:down`.
- **Endpoint probing**: `npm run probe:endpoints` (sanity). Real monitoring provision: `npm run dev:provision`.

## 8. Adding Server Endpoints
- Prefer JSON helpers: use `safeJson(res, data)` for consistent BigInt/function sanitization.
- Authenticate early: `authenticateUser` → business logic → audit log on failures as needed with `logSecurityEvent` or existing helpers.
- Admin-only: chain `requireAdmin`.
- For ingestion-like endpoints enforce `x-api-key` lookup + audit logging on invalid key (`api_key_invalid`).
- Emit security audit events via `storage.createSecurityAuditLog()`; never include secrets in `metadata`.

## 9. Extending Detection / Processing
- Insert logic in `processRawEvent()` after normalization; create additional threat events by calling `storage.createThreatEvent()` and alert via `storage.createAlert()`. Keep batch size manageable (`BATCH_SIZE=100`). Consider retry/ dead-letter if adding complex enrichments.

## 10. Stripe & Payments
- In dev without `STRIPE_SECRET_KEY` a stub object returns minimal structures (see top of `routes.ts`). When implementing billing changes: guard with `if (!(stripe instanceof Stripe))` to avoid assuming full API in stub mode.

## 11. MFA & WebAuthn
- Status endpoint `/api/mfa/status` aggregates TOTP + WebAuthn credentials. Use `storage.getUserMfa()` / `getWebAuthnCredentials()`. When adding new MFA factors ensure lock / attempt counters align with existing `MFA_FAILED_LOCK_THRESHOLD` logic.

## 12. Common Pitfalls
- Forgetting migrations before dev: startup preflight exits; run `npm run db:migrate`.
- Large JSON responses: keep under ~80 chars in log truncation from request logger.
- Missing Stripe keys: endpoints return stubs; tests should assert shape, not full Stripe behavior.
- Legacy auth accidentally enabled in prod: ensure `ALLOW_LEGACY_X_USER_ID` is false.

## 13. Style & Naming
- Migrations: lowercase snake_case; description succinct (e.g., `0004_add_user_sessions.sql`).
- Audit action codes: stable snake_case; update `AUDIT_LOGGING.md` when adding.
- Storage methods: group by domain; follow existing verb prefixes (`get`, `create`, `update`, `search`, `verify`).

## 14. Safety Checklist for Changes
1. Add/modify migration? Use proper script + label if applied changed.
2. New endpoint? Include auth middleware, sanitize output, add audit events if security-relevant.
3. Data model change? Update Drizzle schema + migrations + startup check if critical.
4. Extend client route? Add to `App.tsx` and ensure `ProtectedRoute` if authenticated.

---
Feedback welcome: clarify payment flows, VirusTotal integrations, or MFA nuances? Ask to refine these sections.
