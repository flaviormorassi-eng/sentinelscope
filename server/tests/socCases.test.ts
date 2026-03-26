import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

process.env.ALLOW_LEGACY_X_USER_ID = 'true';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'devsecret';

const TEST_USER_ID = 'soc-case-user';

const storageMock = {
  getUser: vi.fn(),
  getSocCase: vi.fn(),
  upsertSocCase: vi.fn(),
  createSecurityAuditLog: vi.fn(),
};

vi.mock('../storage', () => ({ storage: storageMock }));

let registerRoutes: any;
let app: express.Express;
let agent: any;

describe('/api/soc/cases/:incidentId', () => {
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
    delete process.env.SOC_AUDITOR_USER_IDS;
    storageMock.getUser.mockResolvedValue({ id: TEST_USER_ID, isAdmin: false });
  });

  it('gets case details for an incident', async () => {
    storageMock.getSocCase.mockResolvedValue({
      id: 'case-1',
      userId: TEST_USER_ID,
      incidentId: 'ev-1',
      owner: 'analyst@company.com',
      notes: 'initial triage',
      caseStatus: 'open',
      slaDueAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const res = await agent
      .get('/api/soc/cases/ev-1')
      .set('x-user-id', TEST_USER_ID)
      .expect(200);

    expect(storageMock.getSocCase).toHaveBeenCalledWith(TEST_USER_ID, 'ev-1');
    expect(res.body.data.id).toBe('case-1');
  });

  it('updates case details for an incident', async () => {
    storageMock.upsertSocCase.mockResolvedValue({
      id: 'case-1',
      userId: TEST_USER_ID,
      incidentId: 'ev-1',
      owner: 'owner@company.com',
      notes: 'escalated',
      caseStatus: 'in_progress',
      slaDueAt: new Date('2026-03-24T10:00:00.000Z').toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const res = await agent
      .put('/api/soc/cases/ev-1')
      .set('x-user-id', TEST_USER_ID)
      .send({
        owner: 'owner@company.com',
        notes: 'escalated',
        caseStatus: 'in_progress',
        slaDueAt: '2026-03-24T10:00:00.000Z',
      })
      .expect(200);

    expect(storageMock.upsertSocCase).toHaveBeenCalledWith(
      TEST_USER_ID,
      'ev-1',
      expect.objectContaining({
        owner: 'owner@company.com',
        notes: 'escalated',
        caseStatus: 'in_progress',
      }),
    );
    expect(storageMock.createSecurityAuditLog).toHaveBeenCalled();
    expect(res.body.data.caseStatus).toBe('in_progress');
  });

  it('denies case updates for auditor role', async () => {
    process.env.SOC_AUDITOR_USER_IDS = TEST_USER_ID;

    await agent
      .put('/api/soc/cases/ev-1')
      .set('x-user-id', TEST_USER_ID)
      .send({
        owner: 'auditor@company.com',
        notes: 'attempted write',
        caseStatus: 'in_progress',
      })
      .expect(403);

    expect(storageMock.upsertSocCase).not.toHaveBeenCalled();
    expect(storageMock.createSecurityAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'soc_rbac_denied',
      }),
    );
  });
});
