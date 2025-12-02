import { describe, it, expect, beforeAll, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

process.env.ALLOW_LEGACY_X_USER_ID = 'true';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'devsecret';

const TEST_USER_ID = 'threats-user';
let monitoringMode: 'demo' | 'real' = 'demo';

const demoThreats = Array.from({ length: 30 }).map((_, i) => ({
  id: `t-${i}`,
  userId: TEST_USER_ID,
  description: `Threat #${i}`,
  severity: i % 4 === 0 ? 'critical' : i % 4 === 1 ? 'high' : i % 4 === 2 ? 'medium' : 'low',
  type: ['malware','phishing','ransomware','sql-injection'][i % 4],
  timestamp: new Date(Date.now() - i * 60000).toISOString(),
  sourceIP: `203.0.113.${i}`,
}));

const realThreatEvents = Array.from({ length: 40 }).map((_, i) => ({
  id: `e-${i}`,
  userId: TEST_USER_ID,
  createdAt: new Date(Date.now() - i * 300000).toISOString(),
  severity: i % 3 === 0 ? 'high' : 'medium',
  threatType: ['malware','phishing'][i % 2],
  confidence: 80,
  mitigationStatus: 'detected',
  autoBlocked: false,
  manuallyReviewed: false,
  sourceURL: `http://example${i}.com/page`,
  deviceName: null,
  sourceIP: `198.51.100.${i}`,
  destinationIP: `10.0.0.${i}`,
}));

vi.mock('../storage', () => {
  const storage = {
    async getUserPreferences(userId: string) { return { userId, monitoringMode }; },
    async getThreats(userId: string) { return demoThreats.filter(t => t.userId === userId); },
    async getRecentThreatEvents(userId: string, hours: number) { return realThreatEvents.filter(t => t.userId === userId); },
  };
  return { storage };
});

let registerRoutes: any;
let app: express.Express;
let agent: any;

describe('/api/threats/list', () => {
  beforeAll(async () => {
    app = express();
    app.use(express.json());
    const mod = await import('../routes');
    registerRoutes = mod.registerRoutes;
    await registerRoutes(app);
    agent = request(app);
  });

  it('requires authentication', async () => {
    const res = await agent.get('/api/threats/list');
    expect(res.status).toBe(401);
  });

  it('returns paginated demo threats with meta', async () => {
    monitoringMode = 'demo';
    const res = await agent
      .get('/api/threats/list?limit=10&offset=0')
      .set('x-user-id', TEST_USER_ID)
      .expect(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('total');
    expect(res.body.limit).toBe(10);
    expect(res.body.offset).toBe(0);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(10);
    expect(res.body.total).toBeGreaterThan(10);
  });

  it('applies severity filter', async () => {
    monitoringMode = 'demo';
    const res = await agent
      .get('/api/threats/list?sev=critical&limit=5')
      .set('x-user-id', TEST_USER_ID)
      .expect(200);
    expect(res.body.data.every((t: any) => t.severity === 'critical')).toBe(true);
  });

  it('applies type and source filters together', async () => {
    monitoringMode = 'demo';
    const sample = demoThreats.find(t => t.type === 'phishing')!;
    const ipFragment = sample.sourceIP.split('.').slice(0,3).join('.');
    const res = await agent
      .get(`/api/threats/list?type=phishing&src=${ipFragment}&limit=20`)
      .set('x-user-id', TEST_USER_ID)
      .expect(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data.every((t: any) => t.type === 'phishing' && t.sourceIP.includes(ipFragment))).toBe(true);
  });

  it('returns real monitoring threat events when in real mode', async () => {
    monitoringMode = 'real';
    const res = await agent
      .get('/api/threats/list?limit=15')
      .set('x-user-id', TEST_USER_ID)
      .expect(200);
    expect(res.body.data.length).toBe(15);
    // real events use threatType field
    expect(res.body.data[0]).toHaveProperty('threatType');
  });
});
