import { describe, it, expect, beforeAll, vi } from 'vitest';
import express from 'express';
import supertest from 'supertest';
import { hashApiKey } from '../utils/security';

// Set required env before importing routes
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_dummy';

// In-memory fake storage for tests
const users = new Map<string, any>();
const prefs = new Map<string, any>();
const sources = new Map<string, any>();
const browsing: any[] = [];

vi.mock('../storage', () => {
  const storage = {
    async getUser(id: string) { return users.get(id); },
    async createUser(user: any) { users.set(user.id, { ...user }); return users.get(user.id); },
    async getUserPreferences(userId: string) { return prefs.get(userId); },
    async upsertUserPreferences(p: any) { const existing = prefs.get(p.userId) || { id: 'prefs-'+p.userId, userId: p.userId };
      const merged = { ...existing, ...p }; prefs.set(p.userId, merged); return merged; },
    async createEventSource(s: any) { const id = 'src_'+Math.random().toString(36).slice(2); const rec = { id, ...s, isActive: true };
      sources.set(id, rec); return { id, userId: s.userId, name: s.name, sourceType: s.sourceType, description: s.description || null, isActive: true, metadata: s.metadata || null, createdAt: new Date(), lastHeartbeat: null };
    },
    async verifyEventSourceApiKey(apiKey: string) {
      const hash = hashApiKey(apiKey);
      const match = Array.from(sources.values()).find((s: any) => s.apiKeyHash === hash && s.isActive);
      if (!match) return undefined;
      return { id: match.id, userId: match.userId, name: match.name, sourceType: match.sourceType, description: match.description || null, isActive: true, metadata: match.metadata || null, createdAt: new Date(), lastHeartbeat: null } as any;
    },
    async updateEventSourceHeartbeat(id: string) { const s = sources.get(id); if (s) { s.lastHeartbeat = new Date(); sources.set(id, s); } },
    async createBrowsingActivity(a: any) { const rec = { id: 'ba_'+Math.random().toString(36).slice(2), detectedAt: new Date(), isFlagged: false, ...a }; browsing.push(rec); return rec; },
    async getBrowsingActivity(userId: string) { return browsing.filter(b => b.userId === userId).sort((a,b)=>+new Date(b.detectedAt)-+new Date(a.detectedAt)); },
    async getBrowsingStats(userId: string) {
      const rows = browsing.filter(b=>b.userId===userId);
      const totalVisits = rows.length;
      const uniqueDomains = new Set(rows.map(r=>r.domain)).size;
      const flaggedDomains = new Set(rows.filter(r=>r.isFlagged).map(r=>r.domain)).size;
      const topMap = new Map<string, number>();
      const brMap = new Map<string, number>();
      for (const r of rows) { topMap.set(r.domain, (topMap.get(r.domain)||0)+1); brMap.set(r.browser, (brMap.get(r.browser)||0)+1); }
      const topDomains = Array.from(topMap.entries()).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([domain,count])=>({domain, count}));
      const browserBreakdown = Array.from(brMap.entries()).map(([browser,count])=>({browser, count}));
      return { totalVisits, uniqueDomains, flaggedDomains, topDomains, browserBreakdown };
    },
    // Stubs not used in these tests
    async getEventSources() { return []; },
    async getEventSource() { return undefined; },
    async deleteEventSource() { return; },
    async toggleEventSource() { return; },
  };
  return { storage };
});

let registerRoutes: any;

// NOTE: These tests hit real DbStorage; ensure DATABASE_URL points to a test database.
// For isolation you may want a separate test schema or a transaction wrapper.

const TEST_USER_ID = 'test-user-ingest';
const AUTH_HEADER = { Authorization: 'Bearer dev', 'x-user-id': TEST_USER_ID } as const;

let app: express.Express;
let agent: supertest.SuperTest<supertest.Test>;

let storageRef: any;
async function ensureUser() {
  const existing = await storageRef.getUser(TEST_USER_ID);
  if (!existing) {
    await storageRef.createUser({ id: TEST_USER_ID, email: 'ingest@test.local' } as any);
  }
}

async function enablePrefs() {
  await agent
    .post('/api/browsing/consent')
    .set(AUTH_HEADER)
    .send({ browsingMonitoringEnabled: true, browsingHistoryEnabled: true })
    .expect(200);
}

async function createEventSource() {
  const res = await agent
    .post('/api/event-sources')
    .set(AUTH_HEADER)
    .send({ name: 'Test Source', sourceType: 'agent' })
    .expect(200);
  expect(res.body.apiKey).toBeDefined();
  return res.body.apiKey as string;
}

async function ingest(apiKey: string, events: any[]) {
  return agent
    .post('/api/browsing/ingest')
    .set('x-api-key', apiKey)
    .send({ events })
    .expect(200);
}

describe('Browsing ingest pipeline', () => {
  beforeAll(async () => {
    app = express();
    app.use(express.json());
    // dynamic import after env & mocks
  const mod = await import('../routes');
  registerRoutes = mod.registerRoutes;
  const storageMod: any = await import('../storage');
  storageRef = storageMod.storage;
    await registerRoutes(app);
    agent = supertest(app);
    await ensureUser();
  });

  it('rejects ingest before prefs enabled', async () => {
    const apiKey = await createEventSource();
    const res = await agent
      .post('/api/browsing/ingest')
      .set('x-api-key', apiKey)
      .send({ events: [{ domain: 'example.com', browser: 'Chrome' }] });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/not enabled/i);
  });

  it('enables prefs and ingests events successfully', async () => {
    await enablePrefs();
    const apiKey = await createEventSource();
    const ingestRes = await ingest(apiKey, [
      { domain: 'github.com', browser: 'Chrome', fullUrl: 'https://github.com' },
      { domain: 'news.ycombinator.com', browser: 'Firefox' }
    ]);
    expect(ingestRes.body.success).toBe(true);
    expect(ingestRes.body.received).toBe(2);
  });

  it('lists ingested browsing activity', async () => {
    const listRes = await agent
      .get('/api/browsing')
      .set(AUTH_HEADER)
      .expect(200);
    expect(Array.isArray(listRes.body)).toBe(true);
    expect(listRes.body.length).toBeGreaterThanOrEqual(2);
    const domains = listRes.body.map((a: any) => a.domain);
    expect(domains).toContain('github.com');
  });

  it('returns browsing stats with expected fields', async () => {
    const statsRes = await agent
      .get('/api/browsing/stats')
      .set(AUTH_HEADER)
      .expect(200);
    const stats = statsRes.body;
    for (const key of ['totalVisits','uniqueDomains','flaggedDomains','topDomains','browserBreakdown']) {
      expect(stats).toHaveProperty(key);
    }
    expect(stats.totalVisits).toBeGreaterThanOrEqual(2);
  });

  it('validates ingest schema (empty events)', async () => {
    const apiKey = await createEventSource();
    const badRes = await agent
      .post('/api/browsing/ingest')
      .set('x-api-key', apiKey)
      .send({ events: [] });
    expect(badRes.status).toBe(400);
    expect(badRes.body.error).toMatch(/Invalid request format/i);
  });
});
