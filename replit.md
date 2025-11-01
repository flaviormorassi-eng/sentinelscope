# SentinelScope - Cybersecurity Monitoring Platform

## Overview
SentinelScope is a real-time cybersecurity monitoring platform designed to detect malware, track infiltration attempts, and protect systems with advanced threat intelligence. The platform features real-time threat monitoring, a visual threat map, an alert system, downloadable security reports, and a three-tier subscription model. It aims to provide comprehensive cybersecurity oversight for individuals, SMBs, and enterprises.

## User Preferences
- **Default Theme:** Dark mode
- **Default Language:** English
- **Default Subscription:** Individual tier

## System Architecture
The platform is built with a clear separation between frontend and backend.

**Frontend (`client/`)**:
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter
- **State Management**: TanStack Query (React Query v5)
- **UI Components**: Shadcn UI + Radix UI
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **Maps**: React Leaflet
- **Internationalization**: react-i18next
- **Authentication**: Firebase Auth
- **Design System**: Material Design 3 inspired, consistent 4px baseline grid, WCAG AA compliant accessibility, Inter typography for UI and JetBrains Mono for code. Primary color is Blue (#4285F4). Dark mode is default with a light mode option.
- **Key Pages**: Public Landing Page, Login, Dashboard, Threat Log, Threat Map, Reports, VirusTotal Scanner, Event Sources, Installation Guide, Subscription, Settings, Admin Dashboard, User Management, System Analytics.

**Backend (`server/`)**:
- **Runtime**: Node.js with Express
- **Database**: PostgreSQL with Neon serverless
- **ORM**: Drizzle ORM
- **Storage**: DbStorage
- **Validation**: Zod schemas
- **Report Generation**: jsPDF, jsPDF-AutoTable

**Data Models**:
- **Demo/Legacy**: Users, Threats, Threat Decisions, Alerts, User Preferences, Subscription Tiers, Admin Audit Log.
- **Real Monitoring**: Event Sources, Raw Events, Normalized Events, Threat Events.

**Security Features**: 
- Firebase Authentication (Google OAuth)
- HTTPS enforcement
- API key management with SHA-256 hashing and timing-safe comparison
- Secure credential storage and redaction patterns
- Ownership verification on all event source operations
- Environment variable management via Replit Secrets

**Threat Blocking Workflow**: A semi-automatic system with states (detected, pending_review, blocked, allowed, unblocked) and an admin approval process. All decisions are logged for compliance.

**Monitoring Mode System (NEW - v1.3.0)**:
- **Feature Flag**: Users can toggle between "demo" and "real" monitoring modes in Settings
- **Demo Mode**: Uses mock threat data from the legacy threats table (default for new users)
- **Real Mode**: Uses production event ingestion pipeline with event_sources → raw_events → normalized_events → threat_events
- **Data Routing**: Dashboard API (`GET /api/stats`) respects user's monitoringMode preference and routes queries accordingly
- **Event Source Management**: UI for configuring syslog servers, REST APIs, agents, and webhooks
- **API Key Security**: 
  - Generated with crypto.randomBytes (64 hex chars)
  - Hashed with SHA-256 before database storage
  - Verified using timing-safe comparison to prevent timing attacks
  - Plain API key displayed only once at creation (copy-to-clipboard)
  - apiKeyHash field excluded from all API responses
- **Database Performance**: 9 strategic indexes on high-volume query paths (userId, timestamp, severity, processed flags)

## Event Source Management

**Event Source Types**:
1. **Syslog** - Traditional syslog server integration
2. **REST API** - HTTP/HTTPS API endpoints for custom integrations
3. **Agent** - Deployed monitoring agents on client infrastructure
4. **Webhook** - Callback URLs for event-driven architectures

**Event Processing Pipeline**:
1. External source sends events with API key
2. API key verified via timing-safe hash comparison
3. Event stored in raw_events table (original payload preserved)
4. Background worker normalizes to common schema → normalized_events
5. Threat detection engine analyzes normalized events
6. Threats stored in threat_events table
7. Dashboard queries threat_events when user is in "real" monitoring mode

**Event Source CRUD**:
- Create: Generates secure API key, hashes before storage, returns key once
- List: Shows all user's sources with status, type, heartbeat, no sensitive data
- Toggle: Activate/deactivate sources without deletion
- Delete: Removes source configuration (events remain for audit)

## External Dependencies
- **Firebase Authentication**: For user authentication and Google OAuth.
- **PostgreSQL (via Neon serverless)**: Primary database for persistent storage.
- **VirusTotal API v3**: For live malware scanning of file hashes, URLs, and IP addresses.
- **jsPDF, jsPDF-AutoTable**: For generating security reports in PDF format.
- **Replit Secrets**: For secure management of environment variables.

## Recent Changes

### v1.5.0 (November 1, 2025) - Stripe Payment Integration
- ✅ Integrated Stripe for worldwide payment processing
- ✅ Added subscription database schema (stripeCustomerId, stripeSubscriptionId, stripePriceId, subscriptionStatus, currentPeriodEnd)
- ✅ Implemented subscription creation and management APIs
- ✅ Built Stripe webhook handler for real-time subscription events (payment succeeded/failed, subscription updated/deleted)
- ✅ Added Stripe Billing Portal integration for customer self-service
- ✅ Implemented cancellation flow (non-refundable, cancels at period end)
- ✅ Created comprehensive STRIPE_SETUP.md guide for product configuration
- 🔄 Frontend checkout UI with Stripe Elements (in progress)
- 🔄 Subscription page integration with real payment flow (in progress)

### v1.4.0 (November 1, 2025)
- ✅ Created comprehensive Installation Guide page with step-by-step instructions for Windows, Mac, and Linux
- ✅ Added copy-to-clipboard functionality for all installation commands
- ✅ Integrated Installation Guide into sidebar navigation
- ✅ Updated subscription pricing: Individual tier from $9.99 to $5/month
- ✅ Adjusted Individual tier device limit to 3 devices (affordable entry point)
- ✅ Enhanced threat tracking with sourceURL, deviceName, and threatVector fields
- ✅ Added clickable URLs and threat vector icons to Threat Log
- ✅ Extended search functionality to include new threat detail fields
- ✅ Full bilingual support (EN/PT) for all new features

### v1.3.0 (October 31, 2025)
- ✅ Added monitoring mode feature flag (demo/real toggle in Settings)
- ✅ Created Event Sources page for managing data sources
- ✅ Implemented secure API key generation and management system
- ✅ Added real monitoring database schema (event_sources, raw_events, normalized_events, threat_events)
- ✅ Enhanced dashboard API to route queries based on user's monitoring mode
- ✅ Added 9 strategic database indexes for query performance
- ✅ Implemented API key hashing with SHA-256 and timing-safe verification
- ✅ Created redaction pattern to prevent API key hash leakage in responses
- ✅ Updated sidebar navigation with Event Sources link
- ✅ Added bilingual support (EN/PT) for all new features