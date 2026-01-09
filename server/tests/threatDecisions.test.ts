import { describe, it, expect, beforeAll, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

process.env.ALLOW_LEGACY_X_USER_ID = 'true';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'devsecret';

const TEST_USER_ID = 'decision-user';

const mockThreat = {
  id: 'threat-1',
  userId: TEST_USER_ID,
  status: 'detected',
  blocked: false,
  severity: 'high',
  type: 'malware',
  sourceIP: '1.2.3.4'
};

const mockThreatEvent = {
  id: 'event-1',
  userId: TEST_USER_ID,
  mitigationStatus: 'detected',
  autoBlocked: false,
  severity: 'critical',
  threatType: 'phishing',
  createdAt: new Date().toISOString()
};

const storageMock = {
  getThreatById: vi.fn(),
  updateThreatStatus: vi.fn(),
  recordThreatDecision: vi.fn(),
  getThreatEventById: vi.fn(),
  updateThreatEventStatus: vi.fn(),
  createAuditLog: vi.fn(),
  getUserPreferences: vi.fn().mockResolvedValue({ userId: TEST_USER_ID, monitoringMode: 'demo' }),
};

vi.mock('../storage', () => ({ storage: storageMock }));

let registerRoutes: any;
let app: express.Express;
let agent: any;

describe('/api/threats/:id/decide', () => {
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

  it('handles classic Threat decision (Demo Mode)', async () => {
    storageMock.getThreatById.mockResolvedValue(mockThreat);
    
    const res = await agent
      .post(`/api/threats/${mockThreat.id}/decide`)
      .set('x-user-id', TEST_USER_ID)
      .send({ decision: 'block', reason: 'test block' })
      .expect(200);

    expect(storageMock.getThreatById).toHaveBeenCalledWith(mockThreat.id);
    expect(storageMock.updateThreatStatus).toHaveBeenCalledWith(mockThreat.id, 'blocked', true);
    expect(storageMock.recordThreatDecision).toHaveBeenCalled();
    expect(res.body.id).toBe(mockThreat.id);
  });

  it('handles ThreatEvent decision (Real Mode)', async () => {
    storageMock.getThreatById.mockResolvedValue(undefined);
    storageMock.getThreatEventById.mockResolvedValue(mockThreatEvent);
    
    // Mock the second call to getThreatEventById to return the updated object
    storageMock.getThreatEventById
      .mockResolvedValueOnce(mockThreatEvent) // First call (check existence)
      .mockResolvedValueOnce({ ...mockThreatEvent, mitigationStatus: 'allowed', autoBlocked: false }); // Second call (return updated)

    const res = await agent
      .post(`/api/threats/${mockThreatEvent.id}/decide`)
      .set('x-user-id', TEST_USER_ID)
      .send({ decision: 'allow', reason: 'false positive' })
      .expect(200);

    expect(storageMock.getThreatById).toHaveBeenCalledWith(mockThreatEvent.id);
    expect(storageMock.getThreatEventById).toHaveBeenCalledWith(mockThreatEvent.id);
    expect(storageMock.updateThreatEventStatus).toHaveBeenCalledWith(
      mockThreatEvent.id, 
      'allowed', 
      false, 
      expect.objectContaining({ reviewedBy: TEST_USER_ID, reviewNotes: 'false positive' })
    );
    expect(res.body.id).toBe(mockThreatEvent.id);
    expect(res.body.status).toBe('allowed'); // Mapped from mitigationStatus
  });

  it('returns 404 if neither found', async () => {
    storageMock.getThreatById.mockResolvedValue(undefined);
    storageMock.getThreatEventById.mockResolvedValue(undefined);
    
    await agent
      .post('/api/threats/unknown-id/decide')
      .set('x-user-id', TEST_USER_ID)
      .send({ decision: 'block' })
      .expect(404);
  });
});
