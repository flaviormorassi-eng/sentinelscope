# SentinelScope Government Security Readiness Gaps (March 2026)

## Scope
This document tracks practical readiness against high-assurance expectations commonly seen in SOC 2, ISO 27001, NIST CSF 2.0, and FedRAMP-style programs.

It is not a certification statement.

## Current Baseline
- SOC integration status: operational and validated (SOC incidents, DNS policy, case workflow, escalation, probes).
- CI status: typecheck, migrations gates, security scans, endpoint probes, container scan, SOC regression gate.
- Security logging: structured security audit events for key auth/ingestion and SOC-case actions.

## Control Mapping Snapshot

### 1) Identity & Access Management
- Status: Partial
- Implemented:
  - JWT auth + optional MFA freshness checks.
  - TOTP and WebAuthn support.
  - Admin role guards.
- Gaps:
  - Centralized RBAC policy model (least-privilege roles beyond admin/user).
  - SSO enterprise federation (SAML/OIDC IdP governance profile).
  - Privileged access review cadence and evidence automation.

### 2) Auditability & Forensics
- Status: Partial
- Implemented:
  - Security audit log taxonomy and persistence.
  - SOC case timeline events and SLA breach events.
- Gaps:
  - Immutable/WORM log retention pipeline with signed export bundles.
  - Chain-of-custody workflow for incident evidence exports.
  - Time sync assurance evidence (NTP controls and drift monitoring).

### 3) Data Protection
- Status: Partial
- Implemented:
  - Secret handling via environment config.
  - HTTPS-ready deployment and security headers.
- Gaps:
  - Formal key management policy with rotation SLOs and attestable reports.
  - Encryption-at-rest posture evidence per environment.
  - Data classification and tenant-level data handling policy tags.

### 4) Secure SDLC / Supply Chain
- Status: Strong-Partial
- Implemented:
  - CI gates (typecheck, migrations, tests, coverage, semgrep, gitleaks, trivy, endpoint probes).
  - CodeQL workflow present.
- Gaps:
  - Signed build provenance (SLSA/in-toto style attestations).
  - Mandatory dependency update SLA with policy-as-code enforcement.
  - Reproducible release artifacts and binary integrity verification.

### 5) Operations & Resilience
- Status: Partial
- Implemented:
  - Health/readiness endpoints.
  - Endpoint probe automation.
  - SOC escalation processor and case lifecycle metrics.
- Gaps:
  - Formal DR/BCP runbooks with tested RTO/RPO evidence.
  - Multi-region failover design and tabletop exercise records.
  - Incident command playbooks with communication matrix.

### 6) Governance & Compliance Evidence
- Status: Gap
- Implemented:
  - Internal roadmap and SOC backlog docs.
- Gaps:
  - Unified control library with owners, evidence links, and review cadence.
  - Policy set (access control, vulnerability management, change management, vendor risk).
  - External independent audit scope and cadence.

## Priority 30/60/90-Day Plan

### 0-30 days (must-do)
1. Ship immutable security-audit export (hash + signature + retention lock metadata).
2. Add RBAC role matrix (analyst, responder, admin, auditor) and enforce on SOC actions.
3. Add CI policy check for critical/high dependency advisories with exception workflow.
4. Add disaster recovery runbook with test checkpoint and evidence template.

### 31-60 days
1. Introduce evidence ledger: automatic collection of controls from CI, runtime, and audit logs.
2. Add key rotation compliance dashboard (JWT, API key, webhook/token age).
3. Implement incident evidence package export with chain-of-custody metadata.

### 61-90 days
1. Complete internal pre-audit against SOC 2 + ISO 27001 mapped controls.
2. Run external penetration test and close critical findings.
3. Create trust-center artifact bundle and public-facing control statements.

## Release Gate Recommendation (High-Assurance Mode)
Before production release for regulated/government-sensitive workloads, require:
- `npm run check`
- `npm run test:soc`
- `npm run probe:endpoints`
- zero critical SAST/secret scan findings
- approved migration/security exceptions recorded in PR labels and audit notes

## Ownership
- Security Engineering: control implementation and verification automation.
- Platform Engineering: reliability, DR, operational safeguards.
- Product Security: threat modeling and secure-by-default UX.
- Compliance Lead: policy, evidence, and audit coordination.
