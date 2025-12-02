import { describe, it, expect, beforeAll, vi } from 'vitest';
import express from 'express';
import supertest from 'supertest';
import { hashApiKey } from '../utils/security';

// Ensure required env is present before routes import
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_dummy';

// In-memory storage model for event sources with rotation
interface SrcRec {
  id: string;
  userId: string;
  name: string;
  sourceType: string;
  description?: string | null;
  isActive: boolean;
  apiKeyHash: string; // primary
  secondaryApiKeyHash: string | null; // new key during grace
  rotationExpiresAt: Date | null;
  lastHeartbeat: Date | null;
  createdAt: Date;
}

const users = new Map<string, any>();
const sources = new Map<string, SrcRec>();
const rawEvents: any[] = [];

function newId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2)}`;
}

function makeApiKey() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

vi.mock('../storage', () => {
  const storage = {
    async getUser(id: string) { return users.get(id); },
    async createUser(user: any) { users.set(user.id, { ...user }); return users.get(user.id); },

    async getEventSource(id: string) {
      const s = sources.get(id);
      if (!s) return undefined;
      return { id: s.id, userId: s.userId, name: s.name, sourceType: s.sourceType, description: s.description || null, isActive: s.isActive, lastHeartbeat: s.lastHeartbeat, rotationExpiresAt: s.rotationExpiresAt, secondaryApiKeyHash: s.secondaryApiKeyHash } as any;
    },

    async createEventSource(s: any) {
      const id = crypto.randomUUID?.() || newId('src');
      const rec: SrcRec = {
        id,
        userId: s.userId,
        name: s.name,
        sourceType: s.sourceType,
        description: s.description || null,
        isActive: true,
        apiKeyHash: s.apiKeyHash,
        secondaryApiKeyHash: null,
        rotationExpiresAt: null,
        lastHeartbeat: null,
        createdAt: new Date(),
      };
      // eslint-disable-next-line no-console
      console.error('[mock] stored primary hash', rec.apiKeyHash);
      sources.set(id, rec);
      // storage returns sanitized source; route appends plaintext apiKey
      return { id, userId: s.userId, name: s.name, sourceType: s.sourceType, description: rec.description, secondaryApiKeyHash: rec.secondaryApiKeyHash, rotationExpiresAt: rec.rotationExpiresAt, isActive: true, lastHeartbeat: rec.lastHeartbeat, metadata: s.metadata || null, createdAt: rec.createdAt } as any;
    },

    async rotateEventSourceApiKey(id: string, userId: string, graceSeconds: number = 86400) {
      const s = sources.get(id);
      if (!s || s.userId !== userId || !s.isActive) return undefined;
      const newKey = makeApiKey();
      const oldPrimary = s.apiKeyHash;
      s.apiKeyHash = hashApiKey(newKey); // new becomes primary
      s.secondaryApiKeyHash = oldPrimary; // old moves to secondary
      s.rotationExpiresAt = new Date(Date.now() + Math.max(0, graceSeconds) * 1000);
      sources.set(id, s);
      return { newKey, rotationExpiresAt: s.rotationExpiresAt };
    },

    async forceExpireEventSourceRotation(id: string, userId: string) {
      const s = sources.get(id);
      if (!s || s.userId !== userId) return false;
      s.secondaryApiKeyHash = null;
      s.rotationExpiresAt = new Date();
      sources.set(id, s);
      return true;
    },

    async verifyEventSourceApiKey(apiKey: string) {
      const h = hashApiKey(apiKey);
      // eslint-disable-next-line no-console
      console.error('[mock] verify key hash', h);
      const now = new Date();
      for (const s of sources.values()) {
        // eslint-disable-next-line no-console
        console.error('[mock] stored hashes', { primary: s.apiKeyHash, secondary: s.secondaryApiKeyHash, rotationExpiresAt: s.rotationExpiresAt });
        const primaryMatch = s.apiKeyHash === h;
        const secondaryValid = !!s.secondaryApiKeyHash && s.secondaryApiKeyHash === h && !!s.rotationExpiresAt && s.rotationExpiresAt > now;
        if (s.isActive && (primaryMatch || secondaryValid)) {
          return { id: s.id, userId: s.userId, name: s.name, sourceType: s.sourceType, description: s.description || null, isActive: true, lastHeartbeat: s.lastHeartbeat, rotationExpiresAt: s.rotationExpiresAt } as any;
        }
      }
      return undefined;
    },

    async updateEventSourceHeartbeat(id: string) {
      const s = sources.get(id); if (s) { s.lastHeartbeat = new Date(); sources.set(id, s); }
    },

    async createRawEvent(e: any) {
      const rec = { id: newId('raw'), createdAt: new Date(), ...e };
      rawEvents.push(rec);
      return rec;
    },

    async createSecurityAuditLog() { /* no-op for tests */ },
  };
  return { storage };
});

let registerRoutes: any;

const TEST_USER_ID = 'test-user-rotation';
const AUTH_HEADER = { Authorization: 'Bearer dev', 'x-user-id': TEST_USER_ID } as const;

let app: express.Express;
let agent: supertest.SuperTest<supertest.Test>;
let storageRef: any;

async function ensureUser() {
  const existing = await storageRef.getUser(TEST_USER_ID);
  if (!existing) await storageRef.createUser({ id: TEST_USER_ID, email: 'rotation@test.local' });
}

async function createSource() {
  const res = await agent
    .post('/api/event-sources')
    .set(AUTH_HEADER)
    .send({ name: 'Rotation Test', sourceType: 'agent' })
    .expect(200);
  expect(res.body.apiKey).toBeDefined();
  // eslint-disable-next-line no-console
  console.error('[test] createSource apiKey', res.body.apiKey);
  return res.body as { id: string; apiKey: string };
}

async function ingest(apiKey: string, msg: string) {
  // eslint-disable-next-line no-console
  console.error('[test] ingest with key', apiKey?.slice(0, 12));
  const res = await agent
    .post('/api/ingest/events')
    .set('x-api-key', apiKey)
    .send({ rawData: { msg } });
  return res;
}

describe('Event source key rotation', () => {
  beforeAll(async () => {
    app = express();
    app.use(express.json());
    const mod = await import('../routes');
    registerRoutes = mod.registerRoutes;
    const storageMod: any = await import('../storage');
    storageRef = storageMod.storage;
    await registerRoutes(app);
    agent = supertest(app);
    await ensureUser();
  });

  it('rotates keys with grace window and force-expire works', async () => {
    const created = await createSource();

    const pre = await ingest(created.apiKey, 'pre-rotation');
    if (pre.status !== 201) {
      // help debug on CI
      // eslint-disable-next-line no-console
      console.error('pre-rotation ingest failed', pre.status, pre.body);
    }
    expect(pre.status).toBe(201);

    const rotateRes = await agent
      .post(`/api/event-sources/${created.id}/rotate`)
      .set(AUTH_HEADER)
      .send({ graceSeconds: 60 })
      .expect(200);
    const newKey = rotateRes.body.apiKey as string;
    expect(newKey).toBeDefined();

    const oldWithin = await ingest(created.apiKey, 'old-within-grace');
    expect(oldWithin.status).toBe(201);

    const newWithin = await ingest(newKey, 'new-within-grace');
    expect(newWithin.status).toBe(201);

    await agent
      .post(`/api/event-sources/${created.id}/rotation/expire`)
      .set(AUTH_HEADER)
      .send({})
      .expect(200);

    const oldAfter = await ingest(created.apiKey, 'old-after-expire');
    expect([401, 403]).toContain(oldAfter.status);

    const newAfter = await ingest(newKey, 'new-after-expire');
    expect(newAfter.status).toBe(201);
  });
});
