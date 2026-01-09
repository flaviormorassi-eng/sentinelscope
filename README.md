# SentinelScope

Unified cybersecurity monitoring: network flow visibility, threat detection, browsing activity ingestion, and reports — built with Express, React, Vite, Tailwind, Drizzle ORM, and Stripe.

## Features
- Real-time threats and network flow
- Event ingestion API (agents, extension)
- Alerts with mark-as-read and filters
- Subscriptions (Stripe) and billing portal
- VirusTotal lookup integration
- Admin analytics and compliance tools

## Quick Start

1. Install dependencies
```bash
npm install
```

2. Configure environment
```bash
cp .env.example .env
# fill values
```

3. Initialize database schema
```bash
npm run db:migrate
```

4. Run in development (non-blocking)
```bash
npm run dev:bg
npm run dev:logs
# stop: npm run dev:stop
```

5. Build and run production
```bash
npm run build
PORT=3001 NODE_ENV=production JWT_SECRET=change_me npm start
```

## Environment Variables (Required)
- `DATABASE_URL`: Postgres connection string, e.g. `postgres://sentinel:sentinel@localhost:5432/sentinelscope`
- `JWT_SECRET`: Secret for signing/verifying JWTs
- `PUBLIC_BASE_URL`: e.g. `http://localhost:3001`
- `SESSION_SECRET`: Session secret for cookie/session flows

Optional (dev convenience):
- `ALLOW_LEGACY_X_USER_ID=true` to allow `x-user-id` header/cookie
- `DISABLE_RATE_LIMIT=1` to disable `/api` rate limiting
- `REAL_MONITORING_ALWAYS_ON=true` to force real mode

Stripe (Required for Payments):
- `STRIPE_SECRET_KEY`: Secret key from Stripe Dashboard
- `VITE_STRIPE_PUBLIC_KEY`: Publishable key
- `STRIPE_PRICE_INDIVIDUAL`, `STRIPE_PRICE_SMB`, `STRIPE_PRICE_ENTERPRISE`: Price IDs

VirusTotal (Required for Real Threat Detection):
- `VIRUSTOTAL_API_KEY`: API key from VirusTotal (free tier works)


## One-Shot Bootstrap
Provision a user, promote admin, switch to real mode, seed data, and print a JWT:
```bash
npx tsx scripts/bootstrap.ts \
	--base-url http://localhost:3001 \
	--id <USER_ID> \
	--email <EMAIL> \
	--name "Display Name" \
	--aging 24 \
	--exclude low \
	--alerts \
	--only-new
```
The output prints `token:` for immediate use with `Authorization: Bearer <token>`.

## Docker Compose
```bash
docker compose up -d --build
```
Healthcheck: `curl -s http://localhost:3001/readyz | jq .`
DB: `sentinel/sentinel` at `db:5432`, DB `sentinelscope`.

## Process Managers
### PM2
```bash
npm run build
pm2 start ecosystem.config.cjs --env production
pm2 logs sentinelscope
```

### systemd (sample)
Copy `deploy/sentinelscope.service` to `/etc/systemd/system/` then:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now sentinelscope
sudo systemctl status sentinelscope
```

## Ingestion APIs
- Network/events: `POST /api/ingest/events` (x-api-key)
- Browsing: `POST /api/browsing/ingest` (x-api-key)

See `examples/` for agent scripts and payload formats.

## Development Notes
- Client code under `client/` served from server in production (`dist/public`)
- React Query used for data fetching; Drizzle ORM for Postgres
- Set `PUBLIC_BASE_URL` for correct redirect URLs (Stripe checkout/portal)

## Docs
- Deployment: `DEPLOYMENT_GUIDE.md`
- Stripe setup: `STRIPE_SETUP.md`
- Payment testing: `PAYMENT_TESTING_GUIDE.md`

## License
MIT
