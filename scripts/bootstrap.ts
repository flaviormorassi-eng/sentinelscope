#!/usr/bin/env -S node --enable-source-maps
import 'dotenv/config';

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

type BootstrapOptions = {
  baseUrl: string;
  id: string;
  email: string;
  displayName?: string;
  simulateAgingHours?: number;
  excludeSeverities?: string[];
  onlyNew?: boolean;
  includeAlerts?: boolean;
  includeMediumAlerts?: boolean;
};

function randId(len = 28) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  return Array.from({ length: len }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
}

function parseArgs(): BootstrapOptions {
  const args = process.argv.slice(2);
  const out: any = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--base-url' && args[i + 1]) out.baseUrl = args[++i];
    else if ((a === '--id' || a === '-i') && args[i + 1]) out.id = args[++i];
    else if ((a === '--email' || a === '-e') && args[i + 1]) out.email = args[++i];
    else if (a === '--name' && args[i + 1]) out.displayName = args[++i];
    else if (a === '--aging' && args[i + 1]) out.simulateAgingHours = Number(args[++i]);
    else if (a === '--exclude' && args[i + 1]) out.excludeSeverities = args[++i].split(',').map(s => s.trim());
    else if (a === '--only-new') out.onlyNew = true;
    else if (a === '--alerts') out.includeAlerts = true;
    else if (a === '--alerts-medium') out.includeMediumAlerts = true;
  }
  out.baseUrl ||= process.env.PUBLIC_BASE_URL || 'http://localhost:3001';
  out.id ||= process.env.BOOTSTRAP_USER_ID || randId();
  out.email ||= process.env.BOOTSTRAP_EMAIL || 'admin@example.com';
  out.displayName ||= process.env.BOOTSTRAP_NAME || 'Admin User';
  out.simulateAgingHours ||= Number(process.env.BOOTSTRAP_AGING || 24);
  out.excludeSeverities ||= (process.env.BOOTSTRAP_EXCLUDE || 'low').split(',').map(s => s.trim()).filter(Boolean);
  out.onlyNew ||= process.env.BOOTSTRAP_ONLY_NEW === 'true';
  out.includeAlerts ||= (process.env.BOOTSTRAP_ALERTS || 'true') === 'true';
  out.includeMediumAlerts ||= (process.env.BOOTSTRAP_ALERTS_MEDIUM || 'false') === 'true';
  return out;
}

async function httpJson(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  const text = await res.text();
  let body: any = undefined;
  try { body = text ? JSON.parse(text) : undefined; } catch { body = { raw: text }; }
  if (!res.ok) {
    const msg = body?.error || res.statusText || 'HTTP error';
    throw new Error(`${res.status} ${msg}`);
  }
  return body;
}

async function waitReady(baseUrl: string, timeoutMs = 30_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const j = await httpJson(`${baseUrl}/readyz`);
      if (j?.ok) return;
    } catch {}
    await sleep(1000);
  }
  throw new Error('Service not ready after timeout');
}

async function run() {
  const opts = parseArgs();
  const base = opts.baseUrl.replace(/\/$/, '');
  console.log(`[bootstrap] Base URL: ${base}`);

  await waitReady(base);
  console.log('[bootstrap] Service is ready');

  // 1) Create or sync user
  const user = await httpJson(`${base}/api/auth/user`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: opts.id, email: opts.email, displayName: opts.displayName }),
  });
  console.log('[bootstrap] User upserted:', { id: user.id, email: user.email });

  // 2) Mint JWT
  const jwtRes = await httpJson(`${base}/api/dev/jwt/${encodeURIComponent(opts.id)}`);
  const token = jwtRes.token;
  console.log('[bootstrap] JWT minted');

  // 3) Promote to admin (dev endpoint)
  try {
    await httpJson(`${base}/api/dev/make-admin/${encodeURIComponent(opts.id)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log('[bootstrap] User promoted to admin');
  } catch (e: any) {
    console.warn('[bootstrap] Admin promotion skipped/failed:', e.message);
  }

  // 4) Switch preferences to real monitoring (auto-provision default source)
  try {
    await httpJson(`${base}/api/user/preferences`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ monitoringMode: 'real', browsingMonitoringEnabled: true, browsingHistoryEnabled: true }),
    });
    console.log('[bootstrap] Monitoring mode set to real');
  } catch (e: any) {
    console.warn('[bootstrap] Preferences update failed:', e.message);
  }

  // 5) Seed data with advanced flags
  const seedPayload = {
    excludeSeverities: opts.excludeSeverities,
    simulateAgingHours: opts.simulateAgingHours,
    onlyNew: !!opts.onlyNew,
    includeAlerts: !!opts.includeAlerts,
    includeMediumAlerts: !!opts.includeMediumAlerts,
    autoFlagDomains: true,
    purgeExisting: false,
  };
  const seeded = await httpJson(`${base}/api/dev/seed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(seedPayload),
  });
  console.log('[bootstrap] Seed complete:', {
    rawEventsCreated: seeded.rawEventsCreated,
    threatEventsCount: seeded.threatEventsCount,
    alertsCreated: seeded.alertsCreated,
  });

  // Output token last for easy capture
  console.log('\n=== BOOTSTRAP RESULT ===');
  console.log('userId:', opts.id);
  console.log('email:', opts.email);
  console.log('token:', token);
}

run().catch((e) => {
  console.error('[bootstrap] FAILED:', e);
  process.exit(1);
});
