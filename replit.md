# SentinelScope - Cybersecurity Monitoring Platform

## Overview
SentinelScope is a real-time cybersecurity monitoring platform designed to detect malware, track infiltration attempts, and protect systems with advanced threat intelligence. It provides real-time threat monitoring, a visual threat map, an alert system, and downloadable security reports. The platform targets individuals, SMBs, and enterprises with a three-tier subscription model, aiming to deliver comprehensive cybersecurity oversight and enhance digital security.

## User Preferences
- **Default Theme:** Dark mode
- **Default Language:** English
- **Default Subscription:** Individual tier

## System Architecture
The platform employs a decoupled frontend and backend architecture.

**Frontend (`client/`)**:
- **Technology Stack**: React 18 with TypeScript, Wouter for routing, TanStack Query for state management.
- **UI/UX Design**: Shadcn UI + Radix UI components, Tailwind CSS for styling, Recharts for data visualization, React Leaflet for maps. Material Design 3 inspired, 4px baseline grid, WCAG AA compliant accessibility. Inter typography for UI, JetBrains Mono for code. Primary color: Blue (#4285F4). Dark mode is default with a light mode option.
- **Internationalization**: `react-i18next` for English and Portuguese.
- **Authentication**: Firebase Auth (Google OAuth).
- **Core Pages**: Dashboard, Threat Log, Threat Map, Reports, VirusTotal Scanner, Event Sources, Installation Guide, Subscription, Settings, Admin Dashboard.

**Backend (`server/`)**:
- **Technology Stack**: Node.js with Express.
- **Database**: PostgreSQL via Neon serverless, managed with Drizzle ORM.
- **Data Storage**: DbStorage.
- **Validation**: Zod schemas.
- **Report Generation**: jsPDF, jsPDF-AutoTable.

**Data Models**:
- **Legacy/Demo Data**: Users, Threats, Threat Decisions, Alerts, User Preferences, Subscription Tiers, Admin Audit Log.
- **Real-Time Monitoring Data**: Event Sources, Raw Events, Normalized Events, Threat Events.

**Security & Compliance**:
- Firebase Authentication with Google OAuth.
- HTTPS enforcement.
- API key management with SHA-256 hashing and timing-safe comparison, secure credential storage.
- Ownership verification for all event source operations.
- Environment variables managed via Replit Secrets.
- SOC2/ISO 27001 compliant audit logging (`security_audit_logs` table) and data retention policies.

**Threat Blocking Workflow**:
- Users can block/allow/unblock their own threats (`POST /api/threats/:id/decide`).
- Admins can manage any threat (`POST /api/admin/threats/:id/decide`) with audit logging.
- States: detected, pending_review, blocked, allowed, unblocked.

**Monitoring Mode & Access Control**:
- Users can toggle between "demo" (mock data) and "real" (production data) monitoring modes.
- Strict data separation ensures no mixing between demo and real mode data.
- Access Control: Individual tier includes a 24-hour free trial for real monitoring, SMB/Enterprise tiers have unlimited access.
- Event source management UI for configuring Syslog, REST API, Agent, and Webhook integrations.

**Event Processing Pipeline**:
1. External source sends events with API key.
2. API key verified.
3. Event stored in `raw_events`.
4. Background worker normalizes data into `normalized_events`.
5. Threat detection engine analyzes normalized events.
6. Threats stored in `threat_events`.
7. Dashboard displays `threat_events` in "real" monitoring mode.

**Network Activity Monitoring**:
- Optional feature for tracking browsing activity (domains, IPs, URLs).
- Privacy controls with explicit user consent (GDPR/LGPD compliant), data retention settings, and encrypted storage.
- HTTPS sites show domain only for privacy.

## External Dependencies
- **Firebase Authentication**: User authentication and Google OAuth.
- **PostgreSQL (via Neon serverless)**: Primary data persistence.
- **VirusTotal API v3**: Live malware scanning.
- **jsPDF, jsPDF-AutoTable**: PDF report generation.
- **Replit Secrets**: Secure environment variable management.
- **Stripe**: Payment processing and subscription management.