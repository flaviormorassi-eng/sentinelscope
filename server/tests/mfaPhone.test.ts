import supertest from 'supertest';
import express from 'express';
import { registerRoutes } from '../routes';
import { storage } from '../storage';
import { generateTotpSecret, encryptSecret } from '../utils/mfa';
import { beforeAll, describe, expect, it, vi } from 'vitest';

// Shared app instance for all phone MFA tests
const app = express();
app.use(express.json());
let api: any;

// Mock Twilio and phone verification code generator to produce deterministic code
vi.mock('twilio', () => {
  const twilioMock = () => ({ messages: { create: vi.fn().mockResolvedValue({ sid: 'SM123' }) } });
  return twilioMock as any;
});
vi.mock('../utils/security', () => {
  return {
    hashApiKey: (k: string) => k,
    generateApiKey: () => 'key',
    verifyApiKey: () => true,
    generatePhoneVerificationCode: () => '123456'
  };
});

describe('Phone MFA Flow', () => {
  let userId: string;
  let totpSecret: string;
  beforeAll(async () => {
    process.env.ALLOW_LEGACY_X_USER_ID = 'true';
    process.env.PHONE_MFA_ENABLED = 'true';
    process.env.JWT_SECRET = 'testsecret';
    process.env.TWILIO_ACCOUNT_SID = 'dummy';
    process.env.TWILIO_AUTH_TOKEN = 'dummy';
    process.env.TWILIO_FROM_NUMBER = '+15550000000';
    await registerRoutes(app);
    api = (supertest as any)(app);

    // Create user and TOTP profile
    const user = await storage.createUser({ id: 'u-test', email: 'test@example.com' } as any);
    userId = user.id;
  const generated = await generateTotpSecret('SentinelScope','test@example.com');
  totpSecret = generated.secret;
    await storage.upsertUserMfa(userId, {
      totpEnabled: true,
      totpSecretHash: encryptSecret(totpSecret) as any,
      totpEnabledAt: new Date() as any,
    });
  });

  function authHeader() { return { 'x-user-id': userId }; }

  it('returns base status with new fields', async () => {
  const res = await (api as any).get('/api/mfa/status').set(authHeader());
    expect(res.status).toBe(200);
    expect(res.body.phonePending).toBe(false);
    expect(res.body.maskedPhone).toBeNull();
  });

  it('requests phone verification code', async () => {
  const { authenticator } = require('otplib');
  const currentToken = authenticator.generate(totpSecret);
    const res = await (api as any)
      .post('/api/mfa/phone/request-code')
      .set(authHeader())
      .send({ phoneNumber: '+15551234567', token: currentToken });
    if (res.status !== 200) {
      // aid debugging on CI
      // eslint-disable-next-line no-console
      console.error('request-code error:', res.body);
    }
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  const status = await (api as any).get('/api/mfa/status').set(authHeader());
    expect(status.body.phonePending).toBe(true);
    expect(status.body.phoneVerificationAttempts).toBe(0);
  });

  it('fails verification with wrong code and increments attempts', async () => {
    const bad = await (api as any)
      .post('/api/mfa/phone/verify-code')
      .set(authHeader())
      .send({ code: '000000' });
    expect(bad.status).toBe(400);
  const status = await (api as any).get('/api/mfa/status').set(authHeader());
    expect(status.body.phoneVerificationAttempts).toBe(1);
  });

  it('verifies correct code and enables phone MFA', async () => {
    const good = await (api as any)
      .post('/api/mfa/phone/verify-code')
      .set(authHeader())
      .send({ code: '123456' });
    expect(good.status).toBe(200);
  const status = await (api as any).get('/api/mfa/status').set(authHeader());
    expect(status.body.phoneEnabled).toBe(true);
    expect(status.body.phonePending).toBe(false);
    // New masking keeps country code and last 4 digits, stars in middle
    expect(status.body.maskedPhone).toMatch(/^\+\d{1,3}\*+\d{4}$/);
  });
});

describe('Phone MFA Lockout', () => {
  let lockUserId: string;
  let lockTotpSecret: string;
  function lockAuthHeader() { return { 'x-user-id': lockUserId }; }
  beforeAll(async () => {
    process.env.JWT_SECRET = 'testsecret';
    const user = await storage.createUser({ id: 'u-lock', email: 'lock@example.com' } as any);
    lockUserId = user.id;
    const generated = await generateTotpSecret('SentinelScope','lock@example.com');
    lockTotpSecret = generated.secret;
    await storage.upsertUserMfa(lockUserId, {
      totpEnabled: true,
      totpSecretHash: encryptSecret(lockTotpSecret) as any,
      totpEnabledAt: new Date() as any,
    });
    const { authenticator } = require('otplib');
    const currentToken = authenticator.generate(lockTotpSecret);
    await api
      .post('/api/mfa/phone/request-code')
      .set(lockAuthHeader())
      .send({ phoneNumber: '+15559876543', token: currentToken });
  });

  it('locks after too many invalid verification attempts', async () => {
    // Perform 5 invalid attempts
    for (let i = 0; i < 5; i++) {
      const bad = await api
        .post('/api/mfa/phone/verify-code')
        .set(lockAuthHeader())
        .send({ code: '000000' });
      expect(bad.status).toBe(400);
  const status = await api.get('/api/mfa/status').set(lockAuthHeader());
      expect(status.body.phoneVerificationAttempts).toBe(i + 1);
      expect(status.body.lockedUntil).toBeNull();
    }
    // 6th attempt triggers lock
    const locked = await api
      .post('/api/mfa/phone/verify-code')
      .set(lockAuthHeader())
      .send({ code: '000000' });
    expect(locked.status).toBe(429);
  const finalStatus = await api.get('/api/mfa/status').set(lockAuthHeader());
    expect(finalStatus.body.lockedUntil).toBeTruthy();
  });
});
