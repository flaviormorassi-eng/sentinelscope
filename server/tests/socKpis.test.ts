import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

process.env.ALLOW_LEGACY_X_USER_ID = 'true';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'devsecret';

const TEST_USER_ID = 'soc-kpi-user';
let monitoringMode: 'demo' | 'real' = 'real';

const now = Date.now();

const storageMock = {
  getUserPreferences: vi.fn(async () => ({ userId: TEST_USER_ID, monitoringMode })),
  getThreatEvents: vi.fn(async () => [
    { id: 'ev-1', createdAt: new Date(now - 90 * 60 * 1000).toISOString() },
    { id: 'ev-2', createdAt: new Date(now - 180 * 60 * 1000).toISOString() },
  ]),
  getThreats: vi.fn(async () => [
    { id: 'demo-1', timestamp: new Date(now - 60 * 60 * 1000).toISOString() },
  ]),
  getSocCases: vi.fn(async () => [
    {
      id: 'case-1',
      userId: TEST_USER_ID,
      incidentId: 'ev-1',
      owner: 'analyst@x.com',
      notes: 'triage',
      caseStatus: 'in_progress',
      slaDueAt: new Date(now - 5 * 60 * 1000).toISOString(),
      createdAt: new Date(now - 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(now - 10 * 60 * 1000).toISOString(),
    },
    {
      id: 'case-2',
      userId: TEST_USER_ID,
      incidentId: 'ev-2',
      owner: 'analyst@x.com',
      notes: 'resolved',
      caseStatus: 'resolved',
      slaDueAt: null,
      createdAt: new Date(now - 170 * 60 * 1000).toISOString(),
      updatedAt: new Date(now - 120 * 60 * 1000).toISOString(),
    },
  ]),
};

vi.mock('../storage', () => ({ storage: storageMock }));

let registerRoutes: any;
let app: express.Express;
let agent: any;

describe('/api/soc/kpis', () => {
  beforeAll(async () => {
    app = express();
    app.use(express.json());
    const mod = await import('../routes');
    registerRoutes = mod.registerRoutes;
    await registerRoutes(app);
    agent = request(app);
  });

  beforeEach(() => {
    vi.clearAllMocks();
    monitoringMode = 'real';
  });

  it('returns KPI payload with open/resolved and SLA breach counts', async () => {
    const res = await agent
      .get('/api/soc/kpis?hours=24')
      .set('x-user-id', TEST_USER_ID)
      .expect(200);

    expect(storageMock.getThreatEvents).toHaveBeenCalledWith(TEST_USER_ID, 1000);
    expect(res.body.data.openCases).toBe(1);
    expect(res.body.data.resolvedCases).toBe(1);
    expect(res.body.data.slaBreaches).toBe(1);
    expect(res.body.data.previous).toBeTruthy();
    expect(res.body.data.deltas).toBeTruthy();
    expect(typeof res.body.data.deltas.openCases).toBe('number');
    expect(typeof res.body.data.deltas.slaBreaches).toBe('number');
    expect(typeof res.body.data.avgMttdMinutes === 'number' || res.body.data.avgMttdMinutes === null).toBe(true);
    expect(typeof res.body.data.avgMttrMinutes === 'number' || res.body.data.avgMttrMinutes === null).toBe(true);
  });
});
