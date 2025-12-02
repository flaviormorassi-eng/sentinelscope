# SentinelScope CI Guide

This guide explains our GitHub Actions workflow and provides cross-platform examples (GitLab CI, CircleCI, Jenkins) for migration governance.

## GitHub Actions Overview

Key protections:
 - Pending migrations gate (fails early if unapplied migrations exist).
 - Checksum drift detection (blocks changed applied migrations unless label present).
 - Rollback guard (blocks edits to `*.down.sql` unless label present).
 - Separate security & lint job.
 - Node modules caching.
 - Artifact uploads (migration JSON, test output, coverage directory, JUnit XML, badge).
 - Secret scanning (Gitleaks) & SAST (Semgrep) with SARIF uploads.
 - Slack notifications (summary job) using `SLACK_WEBHOOK_URL` secret.
 - Coverage gating (lines >= 80%, branches >= 70%).
 - Trivy image & filesystem scans (vuln, secret, config) with SARIF.
 - CodeQL static analysis (`javascript`, `cpp`).

### Governance Labels
| Label | Purpose | Effect |
|-------|---------|--------|
| `allow-migration-checksum-update` | Permit updating checksum for previously applied migration after non‑schema edit. | Skip drift failure step. |
| `allow-rollback` | Allow modifying / adding rollback `*.down.sql` files. | Skip rollback guard. |

### Validation Steps
To trigger a workflow run:
1. Open a PR or push to `main` (PR preferred for governance labels).
2. Add required label(s) in the PR if performing checksum remediation or rollback operations.
3. Confirm jobs: `build-and-test` matrix (Node 20/22), `security`, `summary`.
4. Inspect run logs:
   - Pending gate step should show JSON with `pending.length` = 0.
   - Drift check step should either skip (label present) or show zero `warn-changed` results.
   - Rollback guard should pass unless `.down.sql` changes detected.

If a failure occurs, correct migration state or add appropriate label and re-run.

### Recommended Remediation Flow (Changed Migration)
1. Add label `allow-migration-checksum-update`.
2. Run locally: `MIGRATION=000X_name.sql npm run db:migrate:mark-changed`.
3. Commit checksum update.
4. Push → CI should pass drift check.

## GitLab CI Example
Add this `.gitlab-ci.yml`:
```yaml
stages: [precheck, test, security]

variables:
  DATABASE_URL: postgresql://postgres:postgres@postgres:5432/testdb

services:
  - name: postgres:16
    alias: postgres

cache:
  key: "$CI_COMMIT_REF_SLUG"
  paths: [node_modules/]

pending_migrations:
  stage: precheck
  image: node:22
  script:
    - npm ci
    - OUT=$(npm run db:migrate:pending:json | tail -n 1)
    - echo "$OUT"
    - node -e 'const d=JSON.parse(process.argv[1]);if(d.pending.length)process.exit(1)' "$OUT"

migrate_and_test:
  stage: test
  image: node:22
  script:
    - npm ci
    - npm run db:migrate
    - npm test --silent

security_audit:
  stage: security
  image: node:20
  script:
    - npm ci
    - npm audit --omit=dev || echo "Advisories detected"
```

(For drift/rollback you can parse PR labels via GitLab API in a separate script; skipped here for brevity.)

## CircleCI Example
Add `.circleci/config.yml`:
```yaml
version: 2.1
orbs:
  node: circleci/node@5
jobs:
  build-and-test:
    docker:
      - image: cimg/node:22.0
      - image: postgres:16
        environment:
          POSTGRES_PASSWORD: postgres
          POSTGRES_USER: postgres
          POSTGRES_DB: testdb
    environment:
      DATABASE_URL: postgresql://postgres:postgres@localhost:5432/testdb
    steps:
      - checkout
      - node/install-packages:
          pkg-manager: npm
      - run: OUT=$(npm run db:migrate:pending:json | tail -n 1); echo $OUT; node -e 'const d=JSON.parse(process.argv[1]);if(d.pending.length)process.exit(1)' "$OUT"
      - run: npm run db:migrate
      - run: npm test --silent
  security:
    docker:
      - image: cimg/node:20.0
    steps:
      - checkout
      - node/install-packages:
          pkg-manager: npm
      - run: npm audit --omit=dev || echo "Advisories detected"
workflows:
  main:
    jobs:
      - build-and-test
      - security:
          requires: [build-and-test]
```

## Jenkins Pipeline Example
In `Jenkinsfile`:
```groovy
pipeline {
  agent any
  environment {
    DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/testdb'
  }
  stages {
    stage('Setup') {
      steps {
        sh 'npm ci'
      }
    }
    stage('Pending Gate') {
      steps {
        sh '''
        OUT=$(npm run db:migrate:pending:json | tail -n 1)
        echo "$OUT"
        node -e "const d=JSON.parse(process.argv[1]);if(d.pending.length)process.exit(1)" "$OUT"
        '''
      }
    }
    stage('Migrate') { steps { sh 'npm run db:migrate' } }
    stage('Test') { steps { sh 'npm test --silent' } }
    stage('Security') { steps { sh 'npm audit --omit=dev || echo Advisories' } }
  }
}
```
(You may spin up Postgres via a Docker agent or a Jenkins service container.)

## Extending Governance Cross-Platform
- Parse labels or merge request metadata (GitLab: `$CI_MERGE_REQUEST_LABELS`, CircleCI via GitHub API call, Jenkins via scripted REST call) to reproduce drift & rollback guards.
- Block changed applied migrations by computing a checksum table similar to `sentinel_migrations`.

## Slack Notifications
Configure a Slack Incoming Webhook and add the URL as repository secret `SLACK_WEBHOOK_URL`. The summary job posts a status message; failures change color semantics (adjust message formatting in workflow as needed).

## Security Scanning
Current tooling:
 - Gitleaks (secrets) via `gitleaks/gitleaks-action@v2` with minimal `.gitleaks.toml`.
 - Semgrep (SAST) via `returntocorp/semgrep-action@v1` using `config: p/ci` (built-in policy pack). Customize `.semgrep.yml` to exclude generated paths or add rules.
 - Semgrep SARIF upload (GitHub Security > Code scanning alerts).
 - Trivy image & filesystem scans (vuln,secret,config,license) produce table + SARIF outputs.

Recommendation: Periodically review false positives and add allowlists conservatively. Avoid disabling entire rule categories unless noisy and low-value.

## Artifacts
Artifacts uploaded per Node matrix include:
 - `migration-run.json`: last migration apply JSON snapshot.
 - `test-output.txt`: raw test run output.
 - `junit-report.xml`: structured test results (GitHub UI / external parsers).
 - `coverage/` directory: coverage reports.
 - `coverage-badge.svg`: generated coverage badge (lines percentage).

Retention governed by repository settings; increase if audits require longer history.

## Future Enhancements
 - Enforce branch coverage higher threshold (raise from 70% → 75% after stability).
 - Publish coverage badge to repository pages or README via scheduled workflow.
 - Integrate dependency review / license scanning.
 - Add SBOM generation (CycloneDX) and scan.
 - PR comment summarizing key metrics (coverage deltas, vuln counts).

---
For any additions, keep parity with GitHub Actions steps to avoid behavioral drift.
