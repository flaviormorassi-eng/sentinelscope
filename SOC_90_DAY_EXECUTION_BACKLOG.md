# SentinelScope SOC 90-Day Execution Backlog

## Purpose
This backlog converts strategy into executable work for the next 90 days, focused on becoming a top SOC alternative through measurable detection quality, response speed, trust posture, and enterprise readiness.

## Success Targets (Day 90)
- False positive rate: reduce by 20% from current baseline.
- Median MTTD: under 10 minutes for high-severity incidents.
- Median MTTR: under 120 minutes for high-severity incidents.
- SOC workflow adoption: at least 50% of incidents with owner + status + notes + SLA set.
- Reliability: maintain 99.9% API availability for critical SOC endpoints.

## Program Structure
- Cadence: 6 two-week sprints.
- Workstreams:
  1. Detection Quality
  2. Response Automation
  3. SOC Workflow & UX
  4. Trust, Security & Compliance
  5. Integrations & Reporting

---

## Epic 1: Detection Quality v2
### Outcome
Improve signal quality and reduce analyst fatigue.

### Scope
- Add weighted incident risk scoring using severity, source type, confidence, and repeated IOC context.
- Add detection rationale fields for analyst explainability.
- Add suppression suggestions for repeated benign patterns.

### Implementation Tasks
- Backend
  - Extend incident normalization output with risk factors and explanation payload.
  - Add scoring utility in server detection flow.
  - Expose score + rationale in SOC incidents payload.
- Data
  - Add fields to threat metadata for scoring reasons and model version.
- Frontend
  - Add risk score and rationale panel in SOC incident details.
- Testing
  - Unit tests for scoring consistency.
  - API tests for response contract.

### KPIs
- False positives trend down sprint-over-sprint.
- At least 90% of incidents include rationale payload.

---

## Epic 2: Response Automation Playbooks
### Outcome
Reduce MTTR with controlled one-click response.

### Scope
- Standardize playbooks by incident type: phishing, malicious download, suspicious link, credential misuse.
- Add playbook templates with approval levels (auto, analyst, admin).

### Implementation Tasks
- Backend
  - Add playbook execution endpoint with audit logging.
  - Persist playbook run history per incident.
  - Add retry-safe execution model for response actions.
- Frontend
  - Playbook selector in SOC details with action preview.
  - Execution history timeline.
- Security
  - Require fresh MFA for high-impact actions.
- Testing
  - API tests for authorization and audit logging.
  - E2E tests for playbook execution flow.

### KPIs
- At least 40% of high-severity incidents handled with playbook actions.
- MTTR decreases each sprint.

---

## Epic 3: SOC Workflow Completion
### Outcome
Enable complete case lifecycle management.

### Scope
- Case assignment, SLA escalation, status transitions, closure summary.
- KPI trends with semantic labels (already partially implemented) expanded to case lifecycle quality metrics.

### Implementation Tasks
- Backend
  - Add case event history table (status changes, owner changes, SLA changes).
  - Add auto-escalation job for SLA breaches.
  - Add case closure endpoint requiring summary + resolution reason.
- Frontend
  - Case activity timeline.
  - SLA breach indicator and escalation badge.
  - Required closure form.
- Testing
  - Contract tests for case history and closure validations.

### KPIs
- At least 80% of resolved cases include closure summary.
- SLA breach rate decreases by 15% by Day 90.

---

## Epic 4: Trust & Platform Security
### Outcome
Improve security posture and enterprise trust.

### Scope
- Hardening and evidence collection needed for SOC2/ISO track.

### Implementation Tasks
- Security
  - Enforce stricter secret/key rotation policy checks and alerts.
  - Add tamper-evident audit export checksum pipeline.
  - Add sensitive endpoint threat-model checklist gates in PR templates.
- Compliance
  - Build control evidence export script for audit logs and key events.
  - Add trust-center data feeds (uptime, controls, incident response commitments).
- Testing
  - Add periodic security regression suite to CI.

### KPIs
- 100% critical SOC actions have structured audit events.
- 0 critical vulnerabilities unresolved > 7 days.

---

## Epic 5: Integrations That Move Revenue
### Outcome
Increase adoption by integrating where customers already operate.

### Scope (first wave)
- Slack/Teams incident notifications.
- Ticket creation sync (Jira/ServiceNow-lite start).
- One identity source integration for analyst attribution enrichment.

### Implementation Tasks
- Backend
  - Add webhook subscription model + delivery logs.
  - Add outbound connector framework and retry policy.
- Frontend
  - Integration settings page for endpoint/token/config validation.
- Testing
  - Mock connector integration tests and retry behavior tests.

### KPIs
- At least 3 production-ready integrations by Day 90.
- At least 30% of paying tenants enable at least one integration.

---

## Sprint Plan (6 Sprints)

## Sprint 1 (Weeks 1-2)
- Finalize KPI baseline extraction scripts.
- Detection scoring v1 backend skeleton.
- Case history schema + migrations.
- Deliverables:
  - Baseline report
  - New DB migrations
  - Scoring feature flag

## Sprint 2 (Weeks 3-4)
- SOC UI: score and rationale panel.
- Case activity timeline backend + UI.
- Playbook template schema.
- Deliverables:
  - Incident detail enrichments
  - Case timeline view

## Sprint 3 (Weeks 5-6)
- Playbook execution endpoint + audit logs.
- High-impact action MFA freshness requirement.
- SLA auto-escalation worker.
- Deliverables:
  - Executable playbooks v1
  - SLA escalation events

## Sprint 4 (Weeks 7-8)
- Ticketing connector (MVP) + notification connector.
- Integration settings UI.
- Deliverables:
  - Jira/Slack style integration MVP

## Sprint 5 (Weeks 9-10)
- Detection quality tuning pass + suppression recommendations.
- Case closure quality checks and mandatory summary.
- Deliverables:
  - False-positive reduction release
  - Case closure workflow

## Sprint 6 (Weeks 11-12)
- Hardening sprint: trust evidence exports, audit completeness checks.
- Executive KPI dashboard finalization.
- Deliverables:
  - Audit evidence pack scripts
  - Day-90 outcome report

---

## Engineering Backlog by Code Area

## Server
- routes: add playbook execution/history and case closure endpoints.
- storage: add case history model and integration delivery logs.
- eventProcessor: enrich detections with scoring factors.
- middleware: enforce MFA freshness for high-impact actions.

## Shared Schema
- Add `soc_case_events` table.
- Add `soc_playbook_runs` table.
- Add `integration_webhooks` and `integration_delivery_logs` tables.

## Client
- SOC page: score/rationale card, timeline, closure form.
- Settings/integrations: connector setup and validation UI.
- Security Center: KPI overview and trend health summary.

## Tests
- server/tests: playbook execution, case closure validation, SLA escalation, connector retries.
- client tests: SOC detail rendering, closure constraints, integration form validation.

---

## Weekly Operating Ritual
- Monday: KPI review (MTTD/MTTR/FP/SLA).
- Wednesday: detection tuning + quality review.
- Friday: release checkpoint + incident learnings review.

## Monthly Executive Checkpoint
- Outcome scorecard:
  - Detection quality trend
  - Response speed trend
  - Trust/security posture
  - Integration adoption
  - Customer-reported value

## Day-90 Exit Criteria
- KPI targets met or within 10% of target on all core metrics.
- SOC workflow usage over 50% of incidents.
- Integration adoption measurable in production tenants.
- Trust evidence pack generated and audit-ready.
