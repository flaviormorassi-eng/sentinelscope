import { describe, it, expect, beforeAll, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

process.env.ALLOW_LEGACY_X_USER_ID = 'true';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'devsecret';

const TEST_USER_ID = 'alerts-user';

const alerts = Array.from({ length: 35 }).map((_, i) => ({
  id: `a-${i}`,
  userId: TEST_USER_ID,
  threatId: i % 3 === 0 ? 'th-1' : i % 3 === 1 ? 'th-2' : null,
  title: `Alert #${i}`,
  message: i % 2 === 0 ? `Suspicious traffic from host ${i}` : `General security notice ${i}`,
  severity: i % 4 === 0 ? 'critical' : i % 4 === 1 ? 'high' : i % 4 === 2 ? 'medium' : 'low',
  read: i % 5 === 0,
  createdAt: new Date(Date.now() - i * 60_000).toISOString(),
}));

vi.mock('../storage', () => {
  const storage = {
    async getAlerts(userId: string) {
      return alerts.filter((a) => a.userId === userId);
    },
  };
  return { storage };
});

let registerRoutes: any;
let app: express.Express;
let agent: any;

describe('/api/alerts/list', () => {
  beforeAll(async () => {
    app = express();
    app.use(express.json());
    const mod = await import('../routes');
    registerRoutes = mod.registerRoutes;
    await registerRoutes(app);
    agent = request(app);
  });

  it('requires authentication', async () => {
    const res = await agent.get('/api/alerts/list');
    expect(res.status).toBe(401);
  });

  it('returns paginated alerts with metadata', async () => {
    const res = await agent
      .get('/api/alerts/list?limit=10&offset=0')
      .set('x-user-id', TEST_USER_ID)
      .expect(200);

    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(10);
    expect(res.body.total).toBe(35);
    expect(res.body.limit).toBe(10);
    expect(res.body.offset).toBe(0);
    expect(typeof res.body.unreadTotal).toBe('number');
  });

  it('applies severity and unread filters', async () => {
    const res = await agent
      .get('/api/alerts/list?severity=critical&unread=true&limit=50')
      .set('x-user-id', TEST_USER_ID)
      .expect(200);

    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data.every((a: any) => a.severity === 'critical' && !a.read)).toBe(true);
  });

  it('applies query and threat filters', async () => {
    const res = await agent
      .get('/api/alerts/list?q=suspicious&threatId=th-1&limit=50')
      .set('x-user-id', TEST_USER_ID)
      .expect(200);

    expect(res.body.data.length).toBeGreaterThan(0);
    expect(
      res.body.data.every(
        (a: any) =>
          String(a.threatId) === 'th-1' &&
          `${String(a.title || '')} ${String(a.message || '')}`.toLowerCase().includes('suspicious'),
      ),
    ).toBe(true);
  });

  it('returns target metadata for explicit alertId', async () => {
    const targetId = 'a-24';
    const res = await agent
      .get(`/api/alerts/list?limit=10&offset=0&alertId=${targetId}`)
      .set('x-user-id', TEST_USER_ID)
      .expect(200);

    expect(res.body.targetAlertId).toBe(targetId);
    expect(res.body.targetFound).toBe(true);
    expect(res.body.targetIndex).toBe(24);
    expect(res.body.targetPage).toBe(3);
  });

  it('returns derived target metadata from threatId when alertId is missing', async () => {
    const res = await agent
      .get('/api/alerts/list?limit=10&offset=0&threatId=th-2')
      .set('x-user-id', TEST_USER_ID)
      .expect(200);

    expect(res.body.targetAlertId).toBeDefined();
    expect(res.body.targetFound).toBe(true);
    expect(typeof res.body.targetIndex).toBe('number');
    expect(typeof res.body.targetPage).toBe('number');
  });

  it('reports not found when explicit alertId does not exist', async () => {
    const res = await agent
      .get('/api/alerts/list?limit=10&offset=0&alertId=missing-alert-id')
      .set('x-user-id', TEST_USER_ID)
      .expect(200);

    expect(res.body.targetAlertId).toBe('missing-alert-id');
    expect(res.body.targetFound).toBe(false);
    expect(res.body.targetIndex).toBeNull();
    expect(res.body.targetPage).toBeNull();
  });
});
