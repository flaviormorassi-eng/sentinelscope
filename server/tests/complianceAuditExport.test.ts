import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

process.env.ALLOW_LEGACY_X_USER_ID = 'true';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'devsecret';

const TEST_ADMIN_ID = 'compliance-admin';

const storageMock = {
  getUser: vi.fn(),
  getSecurityAuditLogs: vi.fn(),
  createSecurityAuditLog: vi.fn(),
};

vi.mock('../storage', () => ({ storage: storageMock }));

let registerRoutes: any;
let app: express.Express;
let agent: any;

describe('/api/compliance/audit-logs/export', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalSigningKey = process.env.AUDIT_EXPORT_SIGNING_KEY;
  const originalKeyId = process.env.AUDIT_EXPORT_KEY_ID;
  const originalJwtSecret = process.env.JWT_SECRET;

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
    process.env.NODE_ENV = 'test';
    process.env.AUDIT_EXPORT_SIGNING_KEY = 'test-export-key';
    process.env.AUDIT_EXPORT_KEY_ID = 'test-key-id';

    storageMock.getUser.mockResolvedValue({ id: TEST_ADMIN_ID, isAdmin: true });
    storageMock.getSecurityAuditLogs.mockResolvedValue([
      {
        id: 'audit-1',
        userId: 'u-1',
        eventType: 'AUTH',
        eventCategory: 'AUTHENTICATION',
        action: 'login_success',
        status: 'success',
        severity: 'info',
        details: { provider: 'google' },
        metadata: null,
        timestamp: new Date('2026-03-25T12:00:00.000Z').toISOString(),
      },
    ]);
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalSigningKey === undefined) {
      delete process.env.AUDIT_EXPORT_SIGNING_KEY;
    } else {
      process.env.AUDIT_EXPORT_SIGNING_KEY = originalSigningKey;
    }
    if (originalKeyId === undefined) {
      delete process.env.AUDIT_EXPORT_KEY_ID;
    } else {
      process.env.AUDIT_EXPORT_KEY_ID = originalKeyId;
    }
    if (originalJwtSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalJwtSecret;
    }
  });

  it('returns signed immutable export bundle with integrity metadata', async () => {
    const res = await agent
      .get('/api/compliance/audit-logs/export?limit=100')
      .set('x-user-id', TEST_ADMIN_ID)
      .expect(200);

    expect(storageMock.getSecurityAuditLogs).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 100 }),
    );
    expect(res.body?.data?.retention?.immutable).toBe(true);
    expect(res.body?.data?.integrity?.signatureAlgorithm).toBe('hmac-sha256');
    expect(res.body?.data?.integrity?.payloadHash).toBeTruthy();
    expect(res.body?.data?.integrity?.chainHash).toBeTruthy();
    expect(res.body?.data?.integrity?.signature).toBeTruthy();
    expect(res.body?.data?.integrity?.keyId).toBe('test-key-id');
    expect(storageMock.createSecurityAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'compliance_audit_exported',
      }),
    );
  });

  it('fails closed when signing key is missing in production', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.AUDIT_EXPORT_SIGNING_KEY;
    delete process.env.JWT_SECRET;

    const res = await agent
      .get('/api/compliance/audit-logs/export')
      .set('x-user-id', TEST_ADMIN_ID)
      .expect(503);

    expect(res.body?.code).toBe('audit_export_signing_key_missing');
    expect(storageMock.getSecurityAuditLogs).not.toHaveBeenCalled();
  });

  it('verifies a valid signed export bundle', async () => {
    const exportRes = await agent
      .get('/api/compliance/audit-logs/export?limit=100')
      .set('x-user-id', TEST_ADMIN_ID)
      .expect(200);

    const verifyRes = await agent
      .post('/api/compliance/audit-logs/export/verify')
      .set('x-user-id', TEST_ADMIN_ID)
      .send({ bundle: exportRes.body.data })
      .expect(200);

    expect(verifyRes.body?.data?.valid).toBe(true);
    expect(verifyRes.body?.data?.checks?.payloadHashMatches).toBe(true);
    expect(verifyRes.body?.data?.checks?.chainHashMatches).toBe(true);
    expect(verifyRes.body?.data?.checks?.signatureMatches).toBe(true);
    expect(storageMock.createSecurityAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'compliance_audit_export_verified',
        status: 'success',
      }),
    );
  });

  it('rejects tampered export bundle during verification', async () => {
    const exportRes = await agent
      .get('/api/compliance/audit-logs/export?limit=100')
      .set('x-user-id', TEST_ADMIN_ID)
      .expect(200);

    const tamperedBundle = JSON.parse(JSON.stringify(exportRes.body.data));
    tamperedBundle.records[0].action = 'tampered_action';

    const verifyRes = await agent
      .post('/api/compliance/audit-logs/export/verify')
      .set('x-user-id', TEST_ADMIN_ID)
      .send({ bundle: tamperedBundle })
      .expect(409);

    expect(verifyRes.body?.code).toBe('audit_export_verification_failed');
    expect(verifyRes.body?.data?.valid).toBe(false);
    expect(verifyRes.body?.data?.checks?.payloadHashMatches).toBe(false);
    expect(storageMock.createSecurityAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'compliance_audit_export_verified',
        status: 'failure',
      }),
    );
  });
});
