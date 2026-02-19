import { describe, it, expect, beforeAll, vi } from 'vitest';
import express from 'express';
import supertest from 'supertest';
import { hashApiKey } from '../utils/security';

// Ensure required env is set before importing routes
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_dummy';

// Local in-memory fakes scoped to this test file
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
    async createEventSource(s: any) {
      const id = 'src_'+Math.random().toString(36).slice(2);
      const rec = { id, ...s, isActive: true };
      sources.set(id, rec);
      return { id, userId: s.userId, name: s.name, sourceType: s.sourceType, description: s.description || null, isActive: true, metadata: s.metadata || null, createdAt: new Date(), lastHeartbeat: null };
    },
    async verifyEventSourceApiKey(apiKey: string) {
      const hash = hashApiKey(apiKey);
      const match = Array.from(sources.values()).find((s: any) => s.apiKeyHash === hash);
      if (!match) return undefined;
      return { id: match.id, userId: match.userId, name: match.name, sourceType: match.sourceType, description: match.description || null, isActive: !!match.isActive, metadata: match.metadata || null, createdAt: new Date(), lastHeartbeat: null } as any;
    },
    async updateEventSourceHeartbeat(id: string) { const s = sources.get(id); if (s) { s.lastHeartbeat = new Date(); sources.set(id, s); } },
    async createBrowsingActivity(a: any) { const rec = { id: 'ba_'+Math.random().toString(36).slice(2), detectedAt: new Date(), isFlagged: false, ...a }; browsing.push(rec); return rec; },
    async getBrowsingActivity(userId: string) { return browsing.filter(b => b.userId === userId).sort((a,b)=>+new Date(b.detectedAt)-+new Date(a.detectedAt)); },
    async getBrowsingStats(userId: string) { return { totalVisits: 0, uniqueDomains: 0, flaggedDomains: 0, topDomains: [], browserBreakdown: [] }; },
    async getBlockedDomains(_userId: string) { return []; },
    // Stubs for unused paths
    async getEventSources() { return []; },
    async getEventSource() { return undefined; },
    async deleteEventSource() { return; },
    async toggleEventSource() { return; },
  };
  return { storage };
});

let registerRoutes: any;

const TEST_USER_ID = 'test-user-ingest-errors';
const AUTH_HEADER = { 'x-user-id': TEST_USER_ID } as const;

let app: express.Express;
let agent: any;

// Helpers
async function ensureUser(storageRef: any) {
  const existing = await storageRef.getUser(TEST_USER_ID);
  if (!existing) {
    await storageRef.createUser({ id: TEST_USER_ID, email: 'ingest-errors@test.local' } as any);
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
    .send({ name: 'Err Source', sourceType: 'agent' })
    .expect(200);
  expect(res.body.apiKey).toBeDefined();
  return { apiKey: res.body.apiKey as string, id: res.body.id as string };
}

describe('Browsing ingest error branches', () => {
  beforeAll(async () => {
    app = express();
    app.use(express.json());
    const mod = await import('../routes');
    registerRoutes = mod.registerRoutes;
    const storageMod: any = await import('../storage');
    await registerRoutes(app);
    agent = supertest(app);
    await ensureUser(storageMod.storage);
  });

  it('rejects ingest with invalid API key', async () => {
    await enablePrefs();
    // Create a valid source to ensure prefs path is irrelevant here
    await createEventSource();
    const res = await agent
      .post('/api/browsing/ingest')
      .set('x-api-key', 'totally-invalid-key')
      .send({ events: [{ domain: 'example.com', browser: 'Chrome' }] });
    expect([401, 403]).toContain(res.status);
    expect(res.body.error).toMatch(/invalid api key|api key required/i);
  });

  it('rejects ingest when event source is inactive', async () => {
    await enablePrefs();
    const { apiKey, id } = await createEventSource();

    // Flip isActive=false inside the mock storage's sources map
    // We rely on the closure variable declared above
    const rec = sources.get(id);
    expect(rec).toBeTruthy();
    rec.isActive = false;
    sources.set(id, rec);

    const res = await agent
      .post('/api/browsing/ingest')
      .set('x-api-key', apiKey)
      .send({ events: [{ domain: 'inactive.com', browser: 'Firefox' }] });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/not active|inactive/i);
  });
});
