import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import supertest from 'supertest';
import jwt from 'jsonwebtoken';

const verifyIdToken = vi.fn();
const createSecurityAuditLog = vi.fn();

vi.mock('../firebase', () => ({
  auth: {
    verifyIdToken,
  },
}));

vi.mock('../storage', () => ({
  storage: {
    createSecurityAuditLog,
  },
}));

process.env.JWT_SECRET = process.env.JWT_SECRET || 'unit-test-secret';
process.env.NODE_ENV = 'test';

describe('auth middleware', () => {
  beforeEach(() => {
    vi.resetModules();
    verifyIdToken.mockReset();
    createSecurityAuditLog.mockReset();
    delete process.env.JWT_EXPECTED_ISSUER;
    delete process.env.JWT_EXPECTED_AUDIENCE;
  });

  it('authenticates with local JWT bearer token', async () => {
    verifyIdToken.mockRejectedValue(new Error('firebase unavailable'));

    const { authenticateUser } = await import('../middleware/auth');
    const app = express();
    app.get('/secure', authenticateUser, (req: any, res) => res.json({ userId: req.userId }));

    const token = jwt.sign({ sub: 'jwt-user-1' }, process.env.JWT_SECRET as string, { expiresIn: '10m' });

    const res = await supertest(app)
      .get('/secure')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.userId).toBe('jwt-user-1');
  });

  it('optional auth resolves firebase token user id', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'firebase-user-1' });

    const { optionalAuth } = await import('../middleware/auth');
    const app = express();
    app.get('/maybe-auth', optionalAuth, (req: any, res) => res.json({ userId: req.userId || null }));

    const res = await supertest(app)
      .get('/maybe-auth')
      .set('Authorization', 'Bearer firebase-token')
      .expect(200);

    expect(res.body.userId).toBe('firebase-user-1');
  });

  it('optional auth logs invalid token but does not block', async () => {
    verifyIdToken.mockRejectedValue(new Error('invalid token'));

    const { optionalAuth } = await import('../middleware/auth');
    const app = express();
    app.get('/maybe-auth', optionalAuth, (req: any, res) => res.json({ userId: req.userId || null }));

    const res = await supertest(app)
      .get('/maybe-auth')
      .set('Authorization', 'Bearer definitely-invalid')
      .expect(200);

    expect(res.body.userId).toBeNull();
    expect(createSecurityAuditLog).toHaveBeenCalled();
    expect(createSecurityAuditLog.mock.calls[0][0]?.action).toBe('optional_invalid_token');
  });

  it('authenticates with legacy cookie in test mode', async () => {
    const { authenticateUser } = await import('../middleware/auth');
    const app = express();
    app.get('/secure', authenticateUser, (req: any, res) => res.json({ userId: req.userId }));

    const res = await supertest(app)
      .get('/secure')
      .set('Cookie', 'x-user-id=cookie-user-1')
      .expect(200);

    expect(res.body.userId).toBe('cookie-user-1');
  });

  it('rejects local JWT when issuer does not match configured issuer', async () => {
    verifyIdToken.mockRejectedValue(new Error('firebase unavailable'));
    process.env.JWT_EXPECTED_ISSUER = 'sentinelscope-prod';

    const { authenticateUser } = await import('../middleware/auth');
    const app = express();
    app.get('/secure', authenticateUser, (req: any, res) => res.json({ userId: req.userId }));

    const token = jwt.sign({ sub: 'jwt-user-issuer', iss: 'other-issuer' }, process.env.JWT_SECRET as string, { expiresIn: '10m' });

    await supertest(app)
      .get('/secure')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
  });
});
