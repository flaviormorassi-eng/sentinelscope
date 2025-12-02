import { describe, it, expect, beforeAll, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_dummy';

// Minimal in-memory storage mock (extends existing mock shape used in ingest tests)
const users = new Map<string, any>();
const prefs = new Map<string, any>();
const browsing: any[] = [];

vi.mock('../storage', () => {
  const storage = {
    async getUser(id: string) { return users.get(id); },
    async createUser(u: any) { users.set(u.id, { ...u }); return users.get(u.id); },
    async getUserPreferences(userId: string) { return prefs.get(userId); },
    async upsertUserPreferences(p: any) { const existing = prefs.get(p.userId) || { id: 'prefs-'+p.userId, userId: p.userId }; const merged = { ...existing, ...p }; prefs.set(p.userId, merged); return merged; },
    async createBrowsingActivity(a: any) { const rec = { id: 'ba_'+Math.random().toString(36).slice(2), detectedAt: new Date(), isFlagged: false, ...a }; browsing.push(rec); return rec; },
    async getBrowsingActivity(userId: string) { return browsing.filter(b=>b.userId===userId).sort((a,b)=>+new Date(b.detectedAt)-+new Date(a.detectedAt)); },
    async flagDomain(userId: string, domain: string) { for (const r of browsing) { if (r.userId===userId && r.domain===domain) r.isFlagged = true; } },
    async getBrowsingStats(userId: string) {
      const rows = browsing.filter(b=>b.userId===userId);
      const totalVisits = rows.length;
      const uniqueDomains = new Set(rows.map(r=>r.domain)).size;
      const flaggedDomains = new Set(rows.filter(r=>r.isFlagged).map(r=>r.domain)).size;
      return { totalVisits, uniqueDomains, flaggedDomains, topDomains: [], browserBreakdown: [] };
    },
  };
  return { storage };
});

let registerRoutes: any;
let app: express.Express;
let agent: any;

const TEST_USER_ID = 'test-user-flag';
const AUTH = { Authorization: 'Bearer dev', 'x-user-id': TEST_USER_ID } as const;

async function ensureUser(storageRef: any) {
  if (!await storageRef.getUser(TEST_USER_ID)) {
    await storageRef.createUser({ id: TEST_USER_ID, email: 'flag@test.local' } as any);
  }
}

async function enablePrefs() {
  await agent.post('/api/browsing/consent')
    .set(AUTH)
    .send({ browsingMonitoringEnabled: true, browsingHistoryEnabled: true })
    .expect(200);
}

async function seedActivity(domains: string[]) {
  for (const d of domains) {
    await agent.post('/api/browsing/ingest')
      .set('x-api-key', 'fake-key') // ingestion route requires valid event source normally; we bypass by mocking? Actually route verifies source via storage.verifyEventSourceApiKey; not mocked here.
  }
}

describe('Domain flagging', () => {
  beforeAll(async () => {
    app = express();
    app.use(express.json());
    const mod = await import('../routes');
    registerRoutes = mod.registerRoutes;
    await registerRoutes(app);
    const storageMod: any = await import('../storage');
    const storageRef = storageMod.storage;
    await ensureUser(storageRef);
  agent = request(app);
    // Enable prefs
    await enablePrefs();
    // Seed browsing manually through storage (simpler than ingest for this test)
    await storageRef.createBrowsingActivity({ userId: TEST_USER_ID, sourceId: 's1', domain: 'alpha.com', browser: 'Chrome', protocol: 'https' });
    await storageRef.createBrowsingActivity({ userId: TEST_USER_ID, sourceId: 's1', domain: 'beta.com', browser: 'Firefox', protocol: 'https' });
  });

  it('flags a domain and updates stats', async () => {
    // Initial stats
    const statsBefore = await agent.get('/api/browsing/stats').set(AUTH).expect(200);
    expect(statsBefore.body.flaggedDomains).toBe(0);

    // Flag beta.com
    const flagRes = await agent.post('/api/browsing/flag').set(AUTH).send({ domain: 'beta.com' }).expect(200);
    expect(flagRes.body.success).toBe(true);

    // Stats after
    const statsAfter = await agent.get('/api/browsing/stats').set(AUTH).expect(200);
    expect(statsAfter.body.flaggedDomains).toBe(1);
  });

  it('idempotent flagging does not inflate count', async () => {
    const again = await agent.post('/api/browsing/flag').set(AUTH).send({ domain: 'beta.com' }).expect(200);
    expect(again.body.success).toBe(true);
    const stats = await agent.get('/api/browsing/stats').set(AUTH).expect(200);
    expect(stats.body.flaggedDomains).toBe(1);
  });
});
