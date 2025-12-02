#!/usr/bin/env tsx
/**
 * Automated endpoint probes for MFA & WebAuthn health.
 *
 * Usage:
 *   DATABASE_URL=... JWT_SECRET=devsecret npm run db:migrate  # ensure schema
 *   ALLOW_LEGACY_X_USER_ID=true tsx scripts/probe-endpoints.ts --user test-user-1 --base http://localhost:3001
 *
 * Options:
 *   --user <id>      User id to use / provision (default: probe-user)
 *   --email <email>  Email for provisioning (default: probe@example.com)
 *   --base <url>     Base URL of running server (default: http://localhost:3001)
 *   --legacy         Force legacy x-user-id header even if JWT_SECRET present
 *
 * Behavior:
 *   1. Ensures user exists via POST /api/auth/user
 *   2. Calls /api/mfa/status expecting 200 and required keys
 *   3. Calls /api/webauthn/credentials expecting 200 and array (may be empty)
 *   4. Prints JSON summary and sets exit code 0 on success, >0 on failure.
 */
import 'dotenv/config';

interface ProbeResult {
  endpoint: string;
  ok: boolean;
  status: number;
  error?: string;
  body?: any;
  validations?: string[];
}

function parseArgs() {
  const args = process.argv.slice(2);
  const out: any = { user: 'probe-user', email: 'probe@example.com', base: 'http://localhost:3001', legacy: false, jsonOnly: false, output: null };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--user') out.user = args[++i];
    else if (a === '--email') out.email = args[++i];
    else if (a === '--base') out.base = args[++i];
    else if (a === '--legacy') out.legacy = true;
    else if (a === '--json-only') out.jsonOnly = true;
    else if (a === '--output') out.output = args[++i];
  }
  return out;
}

async function ensureUser(base: string, user: string, email: string, headers: Record<string,string>): Promise<void> {
  const res = await fetch(base + '/api/auth/user', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ id: user, email }),
  });
  if (!res.ok) {
    throw new Error(`Failed to provision user: ${res.status} ${res.statusText}`);
  }
}

async function probe(base: string, path: string, headers: Record<string,string>, validate?: (body:any)=>string[]): Promise<ProbeResult> {
  try {
    const res = await fetch(base + path, { headers });
    const ct = res.headers.get('content-type') || '';
    let body: any = undefined;
    if (ct.includes('application/json')) {
      try { body = await res.json(); } catch { body = null; }
    } else {
      body = await res.text();
    }
    const validations = validate ? validate(body) : [];
    return { endpoint: path, ok: res.ok && validations.length === 0, status: res.status, body, validations };
  } catch (e: any) {
    return { endpoint: path, ok: false, status: -1, error: e?.message || String(e) };
  }
}

function validateMfa(body: any): string[] {
  const issues: string[] = [];
  if (!body || typeof body !== 'object') issues.push('response_not_object');
  else {
    for (const key of ['totpEnabled','phoneEnabled','failedAttempts','webauthnCredsCount']) {
      if (!(key in body)) issues.push(`missing_${key}`);
    }
  }
  return issues;
}
function validateCreds(body: any): string[] {
  if (!Array.isArray(body)) return ['not_array'];
  return [];
}

async function main() {
  const args = parseArgs();
  const headers: Record<string,string> = {};
  const jwtSecret = process.env.JWT_SECRET;
  if (jwtSecret && !args.legacy) {
    // For probes we can use a trivial unsigned style by generating a pseudo token? Better to rely on legacy fallback.
    // If JWT_SECRET exists but we don't want to craft a token, force legacy usage.
    headers['x-user-id'] = args.user;
  } else {
    headers['x-user-id'] = args.user;
  }

  if (!args.jsonOnly) console.log('[probe] provisioning user');
  try {
    await ensureUser(args.base, args.user, args.email, headers);
  } catch (e: any) {
    console.error('[probe] user provisioning failed:', e.message);
    process.exit(2);
  }

  if (!args.jsonOnly) console.log('[probe] probing endpoints');
  const results: ProbeResult[] = [];
  results.push(await probe(args.base, '/api/mfa/status', headers, validateMfa));
  results.push(await probe(args.base, '/api/webauthn/credentials', headers, validateCreds));

  const summary = {
    timestamp: new Date().toISOString(),
    base: args.base,
    user: args.user,
    results,
    overallOk: results.every(r => r.ok),
  };
  const jsonStr = JSON.stringify(summary, null, 2);
  console.log(jsonStr);
  if (args.output) {
    try {
      await import('fs').then(fs => fs.writeFileSync(args.output, jsonStr));
      if (!args.jsonOnly) console.log('[probe] wrote', args.output);
    } catch (e: any) {
      console.error('[probe] failed writing output file:', e.message);
    }
  }
  process.exit(summary.overallOk ? 0 : 1);
}

main().catch(err => {
  console.error('[probe] unexpected error', err);
  process.exit(10);
});
