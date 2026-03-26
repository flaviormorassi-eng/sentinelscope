import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

process.env.ALLOW_LEGACY_X_USER_ID = 'true';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'devsecret';

const TEST_USER_ID = 'soc-case-events-user';

const storageMock = {
  getSocCase: vi.fn(),
  upsertSocCase: vi.fn(),
  createSocCaseEvent: vi.fn(),
  getSocCaseEvents: vi.fn(),
  createSecurityAuditLog: vi.fn(),
};

vi.mock('../storage', () => ({ storage: storageMock }));

let registerRoutes: any;
let app: express.Express;
let agent: any;

describe('/api/soc/cases/:incidentId/events', () => {
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
  });

  it('returns timeline events for a SOC case', async () => {
    storageMock.getSocCaseEvents.mockResolvedValue([
      {
        id: 'evt-1',
        userId: TEST_USER_ID,
        incidentId: 'ev-1',
        eventType: 'status_changed',
        actorId: TEST_USER_ID,
        fromValue: 'open',
        toValue: 'in_progress',
        metadata: null,
        createdAt: new Date().toISOString(),
      },
    ]);

    const res = await agent
      .get('/api/soc/cases/ev-1/events?limit=20')
      .set('x-user-id', TEST_USER_ID)
      .expect(200);

    expect(storageMock.getSocCaseEvents).toHaveBeenCalledWith(TEST_USER_ID, 'ev-1', 20);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data[0].eventType).toBe('status_changed');
  });

  it('emits timeline events when case fields change', async () => {
    storageMock.getSocCase.mockResolvedValue({
      id: 'case-1',
      userId: TEST_USER_ID,
      incidentId: 'ev-1',
      owner: 'a@x.com',
      notes: 'old',
      caseStatus: 'open',
      slaDueAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    storageMock.upsertSocCase.mockResolvedValue({
      id: 'case-1',
      userId: TEST_USER_ID,
      incidentId: 'ev-1',
      owner: 'b@x.com',
      notes: 'updated notes',
      caseStatus: 'in_progress',
      slaDueAt: new Date('2026-03-25T10:00:00.000Z').toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await agent
      .put('/api/soc/cases/ev-1')
      .set('x-user-id', TEST_USER_ID)
      .send({
        owner: 'b@x.com',
        notes: 'updated notes',
        caseStatus: 'in_progress',
        slaDueAt: '2026-03-25T10:00:00.000Z',
      })
      .expect(200);

    const eventTypes = storageMock.createSocCaseEvent.mock.calls.map((call: any[]) => call[0].eventType);
    expect(eventTypes).toContain('status_changed');
    expect(eventTypes).toContain('owner_changed');
    expect(eventTypes).toContain('sla_changed');
    expect(eventTypes).toContain('notes_updated');
  });
});
