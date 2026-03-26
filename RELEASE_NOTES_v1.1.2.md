# SentinelScope v1.1.2 Release Notes (2026-03-26)

## 🚀 Release Highlights
- SOC Center is now significantly faster to navigate with a compact command layout and keyboard-first incident triage.
- Real monitoring mode was enforced platform-wide and validated on live API data paths.
- Security hardening expanded across SOC workflows, compliance export integrity, and CI checks.
- Core security surfaces now ship with a consistent command-center visual language.

## 🔐 Security & Compliance
- Enforced SOC RBAC protections on sensitive SOC write operations, including deny-path audit events.
- Added signed compliance audit export with verification and tamper-detection flows.
- Added audit verification tooling and smoke checks to strengthen release safety:
  - `npm run audit:verify -- --file <bundle.json>`
  - `npm run audit:verify:tamper -- --file <bundle.json>`
  - `npm run audit:verify:smoke`
- Extended CI workflow safeguards in [.github/workflows/ci.yml](.github/workflows/ci.yml).

## 🛰️ Real-Mode Operations
- Monitoring preferences were migrated to real mode across users.
- Real ingestion pipeline was validated with active agent traffic and live endpoint checks.
- Confirmed real-mode serving on key operational endpoints (SOC, Threats, Stats, Preferences).

## 🧭 SOC UX & Navigation Improvements
- Compacted SOC Center layout for reduced scroll depth and quicker analyst flow.
- Added sticky quick-navigation bar for jumping between Filters, DNS Policy, KPIs, Incidents, and Details.
- Densified incidents view with tighter row spacing and bounded scroll container.
- Added keyboard incident triage support:
  - Arrow Up / Arrow Down: move row focus
  - Enter / Space: open incident details

## 🗺️ Threat Map & Security Surface Upgrades
- Improved Threat Map performance with viewport optimization, clustering, lazy map mounting, and marker/selection synchronization.
- Added richer focused-context navigation between Alerts, Threat Log, Flow, and Map.
- Unified dashboard and security sections with command-center style shells and consistent visual hierarchy.

## 🌍 Localization & Theme Consistency
- Extended translation coverage for newly introduced SOC/security/network UI states.
- Removed remaining hardcoded style/text patterns in updated components where feasible.
- Improved theme-token alignment for consistent light/dark rendering.

## ✅ Validation Summary
- `npm run quality:security` passed
- `npm test` passed
- `npm run check` passed
- `npm run build` passed
- Endpoint probing and real-mode smoke checks passed

## 📎 QA References
- [THREAT_MAP_QA_CHECKLIST.md](THREAT_MAP_QA_CHECKLIST.md)
