# SentinelScope v1.1.2 Release Notes (2026-03-26)

## Highlights
- SOC hardening with RBAC enforcement on sensitive SOC write operations.
- Immutable signed compliance audit export with online and offline verification.
- CI integrity gates extended with fast-fail audit export smoke checks.
- Threat Map upgraded for performance and usability (lazy load, viewport optimization, clustering, interactive details panel).

## Security & Compliance
- Added SOC role-based protection and deny-path auditing (`soc_rbac_denied`).
- Added signed export endpoint and verification endpoint for audit bundles.
- Added offline verification commands:
  - `npm run audit:verify -- --file <bundle.json>`
  - `npm run audit:verify:tamper -- --file <bundle.json>`
  - `npm run audit:verify:smoke`
- Added CI smoke validation across key jobs in `.github/workflows/ci.yml`.

## Threat Map Improvements
- Reduced render overhead with marker capping + memoized icons.
- Added viewport optimization mode and visible marker count.
- Added zoom-aware cluster mode with drill-in behavior.
- Added lazy map mount with manual load override.
- Added visible threat details panel with click-to-focus map synchronization.
- Added selected-threat state, clear-focus control, and marker↔panel sync.

## Reliability Fixes
- Fixed full-suite rotation test instability by completing mock coverage for `getUserPreferences` in `server/tests/rotation.test.ts`.

## Localization
- Added all new map interaction/performance strings in:
  - `client/src/i18n/locales/en.json`
  - `client/src/i18n/locales/pt.json`

## Validation Status
- `npm run quality:security` ✅
- `npm test` ✅
- `npm run check` ✅
- `npm run build` ✅

## Manual Signoff
- Use `THREAT_MAP_QA_CHECKLIST.md` for final visual interaction confirmation on real data.
