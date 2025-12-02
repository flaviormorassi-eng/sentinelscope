#!/usr/bin/env node
/*
 Ingest browsing events into SentinelScope.
 This tool does NOT generate samples; it posts events you provide via a file, URL, or stdin.

 Usage examples:
   node examples/ingest-browsing.mjs --base http://localhost:3001 \
     --user-id USER123 --token dev --create-source \
     --source-name "Browser Agent" --source-type agent \
     --events-file ./events.json

   echo '{"events":[{"domain":"github.com","browser":"Chrome","fullUrl":"https://github.com"}]}' \
     | node examples/ingest-browsing.mjs --base http://localhost:3001 --api-key YOUR_KEY

   node examples/ingest-browsing.mjs --base http://localhost:3001 --api-key YOUR_KEY --url https://example.com
*/

const args = Object.fromEntries(process.argv.slice(2).map((a, i, arr) => {
  if (!a.startsWith('--')) return [];
  const key = a.replace(/^--/, '');
  const next = arr[i+1];
  if (!next || next.startsWith('--')) return [key, true];
  return [key, next];
}).filter(Boolean));

const base = args.base || process.env.BASE_URL || 'http://localhost:3001';
const token = args.token || process.env.TOKEN || 'dev';
const userId = args['user-id'] || process.env.USER_ID;
const createSource = !!args['create-source'];
const sourceName = args['source-name'] || 'Browsing Agent';
const sourceType = args['source-type'] || 'agent';
const eventsFile = args['events-file'];
const singleUrl = args.url;
let apiKey = args['api-key'] || process.env.API_KEY;
const enablePrefs = !!args['enable-prefs'];

if (!apiKey && !createSource) {
  console.error('Either provide --api-key or use --create-source to generate one.');
  process.exit(1);
}

if (!userId && (enablePrefs || createSource)) {
  console.error('--user-id is required when using --enable-prefs or --create-source');
  process.exit(1);
}

async function http(path, opts = {}) {
  const url = base.replace(/\/$/, '') + path;
  const res = await fetch(url, opts);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? res.json() : res.text();
}

async function ensurePrefs() {
  if (!enablePrefs) return;
  await http('/api/browsing/consent', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'x-user-id': userId,
    },
    body: JSON.stringify({
      browsingMonitoringEnabled: true,
      browsingHistoryEnabled: true,
    })
  });
  console.log('Enabled browsing monitoring + history.');
}

async function createEventSource() {
  if (!createSource) return;
  const res = await http('/api/event-sources', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'x-user-id': userId,
    },
    body: JSON.stringify({ name: sourceName, sourceType, description: 'CLI ingest source' })
  });
  if (!res.apiKey) {
    throw new Error('API key not returned on creation.');
  }
  apiKey = res.apiKey;
  console.log('Created event source:', { id: res.id, name: res.name });
}

function toEventFromUrl(u) {
  try {
    const parsed = new URL(u);
    return {
      domain: parsed.hostname,
      fullUrl: u,
      browser: 'CLI',
      protocol: parsed.protocol.replace(':','') || 'https',
    };
  } catch (e) {
    return {
      domain: u,
      browser: 'CLI',
      protocol: 'https'
    };
  }
}

async function readEvents() {
  if (eventsFile) {
    const fs = await import('node:fs/promises');
    const raw = await fs.readFile(eventsFile, 'utf8');
    if (eventsFile.endsWith('.json')) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed; // assume array of events
      if (Array.isArray(parsed.events)) return parsed.events;
      throw new Error('JSON must be an array or { events: [...] }');
    } else {
      // treat as newline-delimited URLs/domains
      const lines = raw.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
      return lines.map(toEventFromUrl);
    }
  }
  if (singleUrl) {
    return [toEventFromUrl(singleUrl)];
  }
  // read stdin JSON
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  const body = Buffer.concat(chunks).toString('utf8').trim();
  if (!body) throw new Error('No events provided. Use --events-file, --url, or pipe JSON to stdin.');
  const parsed = JSON.parse(body);
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed.events)) return parsed.events;
  throw new Error('Stdin JSON must be an array or { events: [...] }');
}

async function ingest(events) {
  const res = await http('/api/browsing/ingest', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({ events })
  });
  console.log('Ingested:', res);
}

(async () => {
  try {
    await ensurePrefs();
    await createEventSource();
    const events = await readEvents();
    await ingest(events);
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
