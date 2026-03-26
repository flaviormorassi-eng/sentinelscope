import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

process.env.ALLOW_LEGACY_X_USER_ID = 'true';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'devsecret';

const TEST_USER_ID = 'soc-dns-user';

const storageMock = {
  getUser: vi.fn(),
  getUserPreferences: vi.fn(),
  upsertUserPreferences: vi.fn(),
  createSecurityAuditLog: vi.fn(),
};

vi.mock('../storage', () => ({ storage: storageMock }));

let registerRoutes: any;
let app: express.Express;
let agent: any;

describe('/api/soc/dns-policy', () => {
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

  it('returns DNS policy defaults when preferences are missing', async () => {
    storageMock.getUserPreferences.mockResolvedValue({
      userId: TEST_USER_ID,
      monitoringMode: 'real',
    });

    const res = await agent
      .get('/api/soc/dns-policy')
      .set('x-user-id', TEST_USER_ID)
      .expect(200);

    expect(storageMock.getUserPreferences).toHaveBeenCalledWith(TEST_USER_ID);
    expect(res.body.data).toEqual({
      trustedDnsResolvers: '',
      dnsDetectionEnabled: true,
    });
  });

  it('updates DNS policy and normalizes resolver list', async () => {
    storageMock.upsertUserPreferences.mockResolvedValue({
      userId: TEST_USER_ID,
      trustedDnsResolvers: '8.8.8.8,1.1.1.1',
      dnsDetectionEnabled: false,
    });

    const res = await agent
      .put('/api/soc/dns-policy')
      .set('x-user-id', TEST_USER_ID)
      .send({
        trustedDnsResolvers: ' 8.8.8.8, ,1.1.1.1 ',
        dnsDetectionEnabled: false,
      })
      .expect(200);

    expect(storageMock.upsertUserPreferences).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: TEST_USER_ID,
        trustedDnsResolvers: '8.8.8.8,1.1.1.1',
        dnsDetectionEnabled: false,
      }),
    );
    expect(storageMock.createSecurityAuditLog).toHaveBeenCalled();
    expect(res.body.data).toEqual({
      trustedDnsResolvers: '8.8.8.8,1.1.1.1',
      dnsDetectionEnabled: false,
    });
  });

  it('falls back to defaults for invalid payload types', async () => {
    storageMock.upsertUserPreferences.mockResolvedValue({
      userId: TEST_USER_ID,
      trustedDnsResolvers: '',
      dnsDetectionEnabled: true,
    });

    const res = await agent
      .put('/api/soc/dns-policy')
      .set('x-user-id', TEST_USER_ID)
      .send({
        trustedDnsResolvers: ['8.8.8.8'],
        dnsDetectionEnabled: 'false',
      })
      .expect(200);

    expect(storageMock.upsertUserPreferences).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: TEST_USER_ID,
        trustedDnsResolvers: '',
        dnsDetectionEnabled: true,
      }),
    );
    expect(res.body.data).toEqual({
      trustedDnsResolvers: '',
      dnsDetectionEnabled: true,
    });
  });

  it('denies DNS policy updates for auditor role', async () => {
    process.env.SOC_AUDITOR_USER_IDS = TEST_USER_ID;

    await agent
      .put('/api/soc/dns-policy')
      .set('x-user-id', TEST_USER_ID)
      .send({
        trustedDnsResolvers: '8.8.8.8',
        dnsDetectionEnabled: true,
      })
      .expect(403);

    expect(storageMock.upsertUserPreferences).not.toHaveBeenCalled();
    expect(storageMock.createSecurityAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'soc_rbac_denied',
      }),
    );
  });
});
