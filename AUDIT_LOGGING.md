# SentinelScope Security & Compliance Audit Logging

This document defines the audit log taxonomy, usage patterns, and examples for querying logs from the `/api/compliance/audit-logs` endpoint.

## 1. Purpose
Audit logs provide tamper-resistant visibility for security, authentication, and key lifecycle events. They support: 
- Incident response & forensics
- Compliance reporting (SOC 2, ISO 27001)
- Anomalous access detection
- API key rotation tracking

## 2. Data Model
Each log record stored in `security_audit_logs` includes:

| Field | Description |
|-------|-------------|
| `id` | UUID primary key |
| `timestamp` | When the event was recorded (UTC) |
| `userId` | Associated user (nullable for anonymous or failed auth) |
| `eventType` | High-level functional domain (e.g. `auth`, `api_key`) |
| `eventCategory` | Compliance grouping (e.g. `authentication`, `security`) |
| `action` | Specific action code (see taxonomy below) |
| `resourceType` | Type of resource (e.g. `auth`, `event_source`) |
| `resourceId` | Identifier for the resource (nullable if not applicable) |
| `ipAddress` | Source IP (if available) |
| `userAgent` | User agent string (if available) |
| `status` | `success` or `failure` |
| `severity` | `info` | `low` | `warning` | `medium` | `high` | `critical` |
| `details` | Reserved for structured contextual JSON (nullable) |
| `metadata` | Additional machine-parsable JSON data (nullable) |

## 3. Event Categories vs. Types
- `eventType` 
  - Narrow functional domain (what subsystem created the event)
  - Current values: `auth`, `api_key`
- `eventCategory` 
  - Broader compliance grouping (used for reporting filters)
  - Current values: `authentication`, `security`

Multiple `eventType` values can roll up into a single `eventCategory` in compliance dashboards.

## 4. Action Codes (Taxonomy)
### Authentication (`eventType=auth`, `eventCategory=authentication`)
| Action | Trigger | Severity | Notes |
|--------|---------|----------|-------|
| `missing_token` | Protected endpoint called without Bearer token (legacy mode disabled) | warning | Indicates client misconfiguration or attempted unauthenticated access |
| `invalid_or_expired_token` | JWT fails verification (bad signature / expired) | medium | Watch for repeated occurrences from same IP |
| `no_user_identity` | Auth path yields no user ID (legacy allowed but header absent) | medium | Could indicate automation without proper auth setup |
| `internal_error` | Exception inside auth middleware | high | Should be rare; investigate immediately |
| `optional_invalid_token` | Optional auth endpoint with invalid token (not blocked) | low | Occurs on endpoints allowing anonymous access |
| `api_key_missing` | Public ingest endpoint missing `x-api-key` header | warning | Common integration mistake |
| `api_key_invalid` | Provided API key doesn’t match active/rotating hashes | medium | Monitor for brute force |
| `event_source_inactive` | Ingest attempted against disabled event source | warning | Might indicate stale agent or unauthorized usage |

### API Key Lifecycle (`eventType=api_key`, `eventCategory=security`)
| Action | Trigger | Severity | Metadata |
|--------|---------|----------|----------|
| `rotate` | Successful key rotation with grace window | info | `{ graceSeconds, rotationExpiresAt }` |
| `force_expire` | Manual grace period termination | warning | Signals emergency invalidation |

### IP Blocklist Enforcement (`eventType=auth`, `eventCategory=security`)
These are treated as security because they reflect protective controls.
| Action | Trigger | Severity | Metadata |
|--------|---------|----------|----------|
| `ip_blocked_source` | Source IP in blocklist during event ingest | warning | `{ ip }` |
| `ip_blocked_destination` | Destination IP in blocklist during event ingest | warning | `{ ip }` |
| `ip_blocked_browsing` | Blocklisted IP in browsing ingest batch | warning | `{ ip }` |

## 5. Severity Guidelines
Use severities to aid triage:
- `info`: Normal operational events (successful rotation)
- `low`: Non-impacting anomalies (optional invalid token)
- `warning`: Invalid usage patterns or policy enforcement (missing token, inactive source)
- `medium`: Potential abuse signals (invalid/expired token; repeated invalid keys)
- `high`: Internal errors or unexpected states compromising reliability
- `critical`: Reserved for future high-impact security incidents (not currently emitted)

## 6. Querying Audit Logs
Endpoint: `GET /api/compliance/audit-logs` (admin only)

Query parameters:
- `userId` (optional)
- `eventType` (optional)
- `eventCategory` (optional)
- `startDate`, `endDate` (ISO timestamps)
- `limit` (defaults 100)

### Examples
```bash
# All authentication failures last 24h
curl -H "Authorization: Bearer <ADMIN_JWT>" \
  'https://your.domain/api/compliance/audit-logs?eventCategory=authentication&startDate=$(date -u -v-24H +%Y-%m-%dT%H:%M:%SZ)'

# API key lifecycle events
curl -H "Authorization: Bearer <ADMIN_JWT>" \
  'https://your.domain/api/compliance/audit-logs?eventType=api_key'

# Failed events for a specific user
curl -H "Authorization: Bearer <ADMIN_JWT>" \
  'https://your.domain/api/compliance/audit-logs?userId=<USER_ID>&eventCategory=authentication'
```

## 7. Rotation Window Auditing
During rotation:
- Old key hash moves to `secondaryApiKeyHash` with `rotationExpiresAt`.
- `rotate` event records expiration deadline.
- After expiration cleanup job removes `secondaryApiKeyHash` silently (no audit event). Consider adding a future `rotation_cleanup` action if required by policy.
- Emergency termination emits `force_expire`.

## 8. Operational Review Tips
- Track counts of `invalid_or_expired_token` per IP for brute-force heuristics.
- Alert when `internal_error` occurs > 0 in a day.
- Correlate `api_key_invalid` spikes with recent rotations (possible outdated agent deployments).
- Watch for multiple `event_source_inactive` events from same source — may indicate disabled agent still running.

## 9. Extension Roadmap (Optional Enhancements)
Planned or suggested future actions:
| Action | Purpose |
|--------|---------|
| `rotation_cleanup` | Explicit log when grace cleanup executes |
| `api_key_bruteforce_detected` | Emitted when threshold of invalid keys exceeded |
| `suspicious_geo_access` | First successful auth from new country |
| `config_change` | Administrative configuration changes |
| `data_export` | User data export events |

## 10. Retention & Privacy
Recommended retention: 365 days (adjust per compliance scope). Purge beyond retention via scheduled task before implementing archival. Ensure privacy filtering if logs might contain user-agent strings with PII.

## 11. Adding New Events
1. Emit via `storage.createSecurityAuditLog({...})`.
2. Choose appropriate `eventType` (add new if needed) and existing `eventCategory`.
3. Provide meaningful `action` (snake_case, concise, stable).
4. Set `severity` according to impact.
5. Include structured `metadata` for machine parsing; avoid secrets.
6. Update this document and any compliance dashboards.

## 12. Quick Reference Cheat Sheet
```
authentication: missing_token, invalid_or_expired_token, no_user_identity, internal_error,
                optional_invalid_token, api_key_missing, api_key_invalid, event_source_inactive
security:       rotate, force_expire, ip_blocked_source, ip_blocked_destination, ip_blocked_browsing
```

---
_Last updated: 2025-11-13_
