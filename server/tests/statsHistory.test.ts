import { describe, it, expect, beforeAll, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

process.env.ALLOW_LEGACY_X_USER_ID = 'true';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'devsecret';

const TEST_USER_ID = 'stats-user';
let monitoringMode: 'demo' | 'real' = 'demo';
const calls: any[] = [];

vi.mock('../storage', () => {
  const storage = {
    async getUser(id: string) { return { id, email: id + '@example.com' }; },
    async createUser(u: any) { return u; },
    async getUserPreferences(userId: string) { return { userId, monitoringMode }; },
    async getStatsHistory(userId: string, since: Date, interval: 'hour' | 'day', mode: 'demo' | 'real') {
      calls.push({ userId, since, interval, mode });
      const now = Date.now();
      return [2, 1, 0].map((i) => ({
        ts: new Date(now - i * 3600_000).toISOString(),
        active: i * 2,
        blocked: i,
        alerts: i + 1,
        severityCritical: i === 0 ? 1 : 0,
        severityHigh: i === 1 ? 2 : 0,
        severityMedium: i === 2 ? 3 : 0,
        severityLow: 0,
      })).reverse();
    },
  };
  return { storage };
});

let registerRoutes: any;
let app: express.Express;
let agent: any;

describe('/api/stats/history', () => {
  beforeAll(async () => {
    app = express();
    app.use(express.json());
    const mod = await import('../routes');
    registerRoutes = mod.registerRoutes;
    await registerRoutes(app);
    agent = request(app);
  });

  it('requires authentication', async () => {
    const res = await agent.get('/api/stats/history');
    expect(res.status).toBe(401);
  });

  it('returns history buckets with expected shape', async () => {
    monitoringMode = 'demo';
    const res = await agent
      .get('/api/stats/history?hours=2&interval=hour')
      .set('x-user-id', TEST_USER_ID)
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    const sample = res.body[0];
    for (const k of ['ts', 'active', 'blocked', 'alerts', 'severityCritical', 'severityHigh', 'severityMedium', 'severityLow']) {
      expect(sample).toHaveProperty(k);
    }
    expect(calls[calls.length - 1].interval).toBe('hour');
    expect(calls[calls.length - 1].mode).toBe('demo');
  });

  it('includeDerived adds derived percentage and ratio fields', async () => {
    monitoringMode = 'demo';
    const res = await agent
      .get('/api/stats/history?hours=6&interval=hour&includeDerived=true')
      .set('x-user-id', TEST_USER_ID)
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    if (res.body.length) {
      const row = res.body[res.body.length - 1];
      expect(row).toHaveProperty('blockedRatio');
      expect(row).toHaveProperty('severityPctCritical');
      expect(row).toHaveProperty('severityPctHigh');
      expect(row).toHaveProperty('severityPctMedium');
      expect(row).toHaveProperty('severityPctLow');
      expect(row).toHaveProperty('anomalyActive');
      expect(row).toHaveProperty('anomalyBlocked');
    }
  });

  it('defaults interval when omitted', async () => {
    monitoringMode = 'demo';
    const res = await agent
      .get('/api/stats/history?hours=1')
      .set('x-user-id', TEST_USER_ID)
      .expect(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(calls[calls.length - 1].interval).toBe('hour');
  });

  it('passes real mode through to storage layer', async () => {
    monitoringMode = 'real';
    const res = await agent
      .get('/api/stats/history?hours=1')
      .set('x-user-id', TEST_USER_ID)
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(calls[calls.length - 1].mode).toBe('real');
  });
});
