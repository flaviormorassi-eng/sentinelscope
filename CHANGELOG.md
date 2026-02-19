# Changelog

All notable changes to this project will be documented in this file.

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
