# Changelog

All notable changes to this project will be documented in this file.

## v1.1.2 - 2026-03-26

Customer summary: see [RELEASE_NOTES_PUBLIC_v1.1.2.md](RELEASE_NOTES_PUBLIC_v1.1.2.md).

### Added
- SOC RBAC middleware for write-protected SOC routes with role-based deny auditing (`soc_rbac_denied`).
- Signed immutable compliance audit export endpoint and offline verification tooling (`audit:verify`, `audit:verify:tamper`, `audit:verify:smoke`).
- Compliance export verification endpoint with tamper detection and structured verification responses.
- CI fast-fail integrity smoke coverage across `build-and-test`, `security`, and `endpoint-probes` jobs.
- Threat Map performance controls: lazy map mount, viewport optimization toggle, cluster mode toggle, visible marker counters.
- Threat details panel and richer cluster popup summaries with actionable map focus interactions.
- Threat Map QA checklist document for manual closeout validation.

### Changed
- Security quality gate now includes deterministic audit export smoke verification.
- Threat Map rendering strategy optimized with marker capping, memoized icon usage, targeted fit behavior, and zoom-aware clustering.
- Threat detail cards now synchronize with map marker focus, including selected-state UX and clear-focus controls.

### Fixed
- Rotation integration test mock now includes user preferences retrieval required by ingest route (`getUserPreferences`) to prevent false 500 failures.
- Added missing map localization keys in English and Portuguese for new interaction and performance controls.

## v1.1.1 - 2026-02-19

### Fixed
- Resolved TypeScript build break caused by unsupported `Button` `variant="link"` usage in triage pages.
- Updated affected actions to use supported button variants while preserving link-like interaction styling.

## v1.1.0 - 2026-02-19

### Added
- Cross-page triage navigation context between Flow, Threats, Alerts, and Map with deep-link focus support.
- Server-side paginated alerts listing endpoint with target metadata (`targetFound`, `targetIndex`, `targetPage`).
- New automated test coverage for alerts list targeting and pagination behavior.
- Extended backend test coverage for ingest pipeline, event processor detections, and WebAuthn lock behavior.
- Operational scripts for diagnostics, provisioning, and maintenance.
- Mobile platform scaffolds for Android and iOS (Capacitor).
- PWA support in the web build configuration.
- Newsletter subscription schema and migration.

### Changed
- Improved real-time processing pipeline with richer threat patterns and normalized event extraction.
- Hardened auth behavior defaults for legacy auth handling and production safety checks.
- Improved client MFA challenge flow and admin/data-management UX.
- Updated branding/contact email references across UI and email service.
- Added platform scripts for running real/simulated monitoring agents.

### Fixed
- Improved endpoint consistency and context-preserving navigation across triage pages.
- Avoided duplicate alert creation in dev data seeding flow.
- Added Python cache ignores and repository cleanup for transient artifacts.
