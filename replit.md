# SentinelScope - Cybersecurity Monitoring Platform

## Overview
SentinelScope is a real-time cybersecurity monitoring platform that detects malware, tracks infiltration attempts, and protects systems with advanced threat intelligence. Built with React, Node.js/Express, and Firebase Authentication.

## Current State
**Status:** MVP Complete
**Version:** 1.0.0
**Last Updated:** October 30, 2025

### Implemented Features
- ✅ Firebase Authentication with Google OAuth
- ✅ Real-time threat monitoring dashboard
- ✅ Visual threat map with IP geolocation
- ✅ Alert system with in-app notifications
- ✅ Threat activity log with filtering and search
- ✅ Downloadable security reports (PDF, CSV, JSON)
- ✅ Three-tier subscription system (Individual, SMB, Enterprise)
- ✅ Role-based dashboard views
- ✅ Dark/light theme toggle
- ✅ Bilingual support (English, Portuguese)
- ✅ Fully responsive design
- ✅ Mock threat detection engine
- ✅ VirusTotal API integration for live malware scanning

## Project Architecture

### Frontend (`client/`)
- **Framework:** React 18 with TypeScript
- **Routing:** Wouter
- **State Management:** TanStack Query (React Query v5)
- **UI Components:** Shadcn UI + Radix UI
- **Styling:** Tailwind CSS
- **Charts:** Recharts
- **Maps:** React Leaflet
- **i18n:** react-i18next
- **Authentication:** Firebase Auth

### Backend (`server/`)
- **Runtime:** Node.js with Express
- **Database:** PostgreSQL with Neon serverless
- **ORM:** Drizzle ORM
- **Storage:** DbStorage (replaces MemStorage for persistence)
- **Validation:** Zod schemas
- **Report Generation:** jsPDF, jsPDF-AutoTable

### Data Models (`shared/schema.ts`)
- Users (Firebase integration)
- Threats (with geolocation)
- Alerts
- User Preferences
- Subscription Tiers

## Key Pages
1. **Login** (`/login`) - Google OAuth authentication
2. **Dashboard** (`/`) - Overview with stats, charts, threat feed
3. **Threat Log** (`/threats`) - Full threat history with filters
4. **Threat Map** (`/map`) - Geographic visualization of attacks
5. **Reports** (`/reports`) - Generate and download security reports
6. **VirusTotal Scanner** (`/virustotal`) - Scan file hashes, URLs, and IPs for malware
7. **Subscription** (`/subscription`) - Plan selection and management
8. **Settings** (`/settings`) - User preferences, theme, language

## API Endpoints

### Authentication
- `POST /api/auth/user` - Create/sync user
- `GET /api/user/:id` - Get user details

### Dashboard
- `GET /api/stats` - Get threat statistics
- `GET /api/threats/timeline` - 24-hour threat timeline
- `GET /api/threats/by-type` - Threat distribution by type

### Threats
- `GET /api/threats` - All threats for user
- `GET /api/threats/recent` - Recent threats (limit 10)
- `GET /api/threats/map` - Threats with geolocation
- `POST /api/threats/generate` - Generate mock threats

### Alerts
- `GET /api/alerts` - All alerts
- `GET /api/alerts/recent` - Recent alerts
- `POST /api/alerts/:id/read` - Mark alert as read

### User Management
- `GET /api/user/preferences` - Get user preferences
- `PUT /api/user/preferences` - Update preferences
- `GET /api/user/subscription` - Get subscription tier
- `POST /api/user/subscription` - Update subscription

### Reports
- `POST /api/reports/generate` - Generate PDF/CSV/JSON report

### VirusTotal Integration
- `POST /api/virustotal/check-hash` - Check file hash (MD5, SHA-1, SHA-256) against VT database
- `POST /api/virustotal/check-url` - Scan URL for malicious content
- `POST /api/virustotal/check-ip` - Check IP address reputation

### Utilities
- `POST /api/init-demo-data` - Initialize demo data for new users

## Mock Data System
The threat detection engine generates realistic mock data with:
- 8 threat types (malware, phishing, DDoS, brute force, SQL injection, XSS, ransomware, botnet)
- 4 severity levels (low, medium, high, critical)
- Geographic origins (Russia, China, Iran, Ukraine, Netherlands, Germany, Romania, India, Brazil, Nigeria)
- Realistic IP addresses and attack descriptions
- Temporal distribution over 24 hours

## Design System
- **Primary Color:** Blue (#4285F4) - Professional, trustworthy
- **Typography:** Inter (UI), JetBrains Mono (code/IPs)
- **Theme:** Dark mode default, light mode available
- **Components:** Material Design 3 inspired
- **Spacing:** Consistent 4px baseline grid
- **Accessibility:** WCAG AA compliant

## Internationalization (i18n)
- **Languages:** English (en), Brazilian Portuguese (pt)
- **Storage:** localStorage
- **Coverage:** All UI text, navigation, forms, alerts, errors

## Security Features
- Firebase Authentication (Google OAuth)
- HTTPS enforcement
- Environment variable management via Replit Secrets
- No sensitive data in frontend code

## VirusTotal Integration
The platform integrates with VirusTotal API v3 for live malware scanning:
- **File Hash Checking:** Support for MD5 (32 chars), SHA-1 (40 chars), SHA-256 (64 chars)
- **URL Scanning:** Check URLs for malicious content and phishing
- **IP Reputation:** Lookup IP address threat intelligence
- **Results Display:** Color-coded results with malicious/suspicious/harmless counts
- **Direct Links:** One-click access to full VirusTotal reports
- **Input Validation:** Robust regex validation with clear error messages
- **Error Handling:** Rate limit detection, 404 handling, user-friendly messages
- **Fully Localized:** All UI strings available in English and Portuguese

Technical Details:
- Uses native Node.js fetch (Node 18+)
- All endpoints protected with authentication middleware
- Returns structured results with detection statistics
- Handles VirusTotal API rate limits gracefully

## Environment Variables
Required secrets (stored in Replit Secrets):
- `VIRUSTOTAL_API_KEY`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_API_KEY`

## Running the Application
```bash
npm run dev
```

This starts:
- Express backend on port 5000
- Vite dev server (frontend)
- Both accessible at http://localhost:5000

## Recent Changes (October 30, 2025)
- ✅ Completed MVP implementation
- ✅ Added comprehensive mock threat engine
- ✅ Implemented all API endpoints
- ✅ Created report generation system
- ✅ Built complete frontend with all pages
- ✅ Integrated Firebase Authentication
- ✅ Added bilingual support (EN/PT)
- ✅ Implemented theme switcher
- ✅ Created subscription tier system
- ✅ **CRITICAL: Migrated from in-memory to PostgreSQL database for data persistence**
- ✅ Implemented DbStorage with Drizzle ORM and Neon serverless
- ✅ All threats, alerts, user data now persist across server restarts

## Next Phase Features (In Progress)
- ✅ VirusTotal API integration (completed - file hash, URL, IP scanning)
- 🚧 Email/SMS notifications (next)
- 🚧 Stripe payment integration (pending)
- 🚧 Admin panel for user management (pending)
- Real threat intelligence feeds integration
- Actual network monitoring agents
- Native mobile apps (React Native)
- Offline detection capabilities
- ML-based threat prediction
- Cloud Functions for automation

## User Preferences
- **Default Theme:** Dark mode
- **Default Language:** English
- **Default Subscription:** Individual tier

## Project Structure
```
├── client/               # Frontend React application
│   ├── src/
│   │   ├── components/   # Reusable UI components
│   │   ├── contexts/     # React contexts (Auth, Theme)
│   │   ├── i18n/         # Translations
│   │   ├── lib/          # Utilities, Firebase config
│   │   └── pages/        # Route pages
│   └── index.html
├── server/               # Backend Express application
│   ├── routes.ts         # API routes
│   ├── storage.ts        # Data persistence layer
│   └── utils/            # Threat generator, reports
├── shared/               # Shared TypeScript types
│   └── schema.ts         # Zod schemas and types
└── design_guidelines.md  # UI/UX design system
```

## Testing Notes
- Demo data automatically generated for new users
- 50 sample threats distributed over past 24 hours
- Alerts created for critical/high severity threats
- All features work with mock data
- No external API dependencies (except Firebase Auth)
