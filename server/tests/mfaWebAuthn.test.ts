import supertest from 'supertest';
import express from 'express';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { registerRoutes } from '../routes';
import { storage } from '../storage';

// Mock @simplewebauthn/server to produce deterministic behavior
vi.mock('@simplewebauthn/server', () => {
  return {
    generateRegistrationOptions: vi.fn().mockImplementation((_args: any) => {
      return {
        challenge: 'reg-chal',
        rpID: 'localhost',
        rpName: 'SentinelScope',
        timeout: 60000,
        attestation: 'none',
        excludeCredentials: _args.excludeCredentials || [],
        userVerification: 'preferred',
      } as any;
    }),
    verifyRegistrationResponse: vi.fn().mockImplementation((_args: any) => {
      return {
        verified: true,
        registrationInfo: {
          credentialPublicKey: Buffer.from('pub'),
          credentialID: Buffer.from('cred-id'),
          counter: 1,
          aaguid: '00000000-0000-0000-0000-000000000000'
        },
      } as any;
    }),
    generateAuthenticationOptions: vi.fn().mockImplementation((_args: any) => {
      return {
        challenge: 'auth-chal',
        rpID: 'localhost',
        allowCredentials: _args.allowCredentials || [],
        userVerification: 'preferred',
        timeout: 60000,
      } as any;
    }),
    verifyAuthenticationResponse: vi.fn().mockImplementation((_args: any) => {
      const mode = process.env.WEBAUTHN_TEST_MODE || 'ok';
      return {
        verified: true,
        authenticationInfo: {
          newCounter: mode === 'anomaly' ? 0 : 2,
        },
      } as any;
    }),
  };
});

// Shared app instance for all WebAuthn tests
const app = express();
app.use(express.json());
let api: any;

describe('WebAuthn MFA Flow', () => {
  let userId: string;

  beforeAll(async () => {
    process.env.ALLOW_LEGACY_X_USER_ID = 'true';
    process.env.JWT_SECRET = 'testsecret';
    process.env.WEBAUTHN_RP_ID = 'localhost';
    process.env.WEBAUTHN_ORIGIN = 'http://localhost:3000';

    await registerRoutes(app);
    api = (supertest as any)(app);

    // create user
    const user = await storage.createUser({ id: 'u-webauthn', email: 'webauthn@example.com' } as any);
    userId = user.id;
  });

  function authHeader() { return { 'x-user-id': userId }; }

  it('reports initial status with zero webauthn credentials', async () => {
    const res = await api.get('/api/mfa/status').set(authHeader());
    expect(res.status).toBe(200);
    expect(res.body.webauthnCredsCount).toBe(0);
  });

  it('generates registration options and completes registration', async () => {
    const opts = await api.get('/api/webauthn/register/options').set(authHeader());
    expect(opts.status).toBe(200);
    expect(opts.body.challenge).toBeTruthy();

    const verify = await api
      .post('/api/webauthn/register/verify')
      .set(authHeader())
      .send({
        id: 'cred-id',
        rawId: 'Y3JlZC1pZA',
        type: 'public-key',
        response: { clientDataJSON: 'x', attestationObject: 'y' },
      });
    if (verify.status !== 200) {
      // eslint-disable-next-line no-console
      console.error('register/verify error:', verify.body);
    }
    expect(verify.status).toBe(200);
    expect(verify.body.success).toBe(true);

  // Small delay to allow async storage update to settle in test environment
  await new Promise(r => setTimeout(r, 5));
  const status = await api.get('/api/mfa/status').set(authHeader());
    expect(status.status).toBe(200);
    expect(status.body.webauthnCredsCount).toBe(1);
  });

  it('generates auth options and verifies assertion (happy path)', async () => {
    const opts = await api.get('/api/webauthn/auth/options').set(authHeader());
    expect(opts.status).toBe(200);
    expect(opts.body.challenge).toBeTruthy();
    expect(Array.isArray(opts.body.allowCredentials)).toBe(true);
    const credId = opts.body.allowCredentials[0]?.id;
    expect(credId).toBeTruthy();

    const verify = await api
      .post('/api/webauthn/auth/verify')
      .set(authHeader())
      .send({
        id: credId,
        rawId: credId,
        type: 'public-key',
        response: {
          clientDataJSON: 'x',
          authenticatorData: 'y',
          signature: 'z',
          userHandle: null,
        },
      });
    if (verify.status !== 200) {
      // eslint-disable-next-line no-console
      console.error('auth/verify error:', verify.body);
    }
    expect(verify.status).toBe(200);
    expect(verify.body.success).toBe(true);
    expect(verify.body.warning).toBeFalsy();
  });

  it('flags signCount anomaly when newCounter does not increase', async () => {
    // set mode to anomaly in mock
    process.env.WEBAUTHN_TEST_MODE = 'anomaly';

    const opts = await api.get('/api/webauthn/auth/options').set(authHeader());
    const credId = opts.body.allowCredentials[0]?.id;

    const verify = await api
      .post('/api/webauthn/auth/verify')
      .set(authHeader())
      .send({
        id: credId,
        rawId: credId,
        type: 'public-key',
        response: {
          clientDataJSON: 'x',
          authenticatorData: 'y',
          signature: 'z',
          userHandle: null,
        },
      });

    expect(verify.status).toBe(200);
    expect(verify.body.success).toBe(true);
    expect(verify.body.warning).toBe('sign_count_anomaly_detected');

    // reset mode
    delete process.env.WEBAUTHN_TEST_MODE;
  });
});

describe('WebAuthn credential management', () => {
  let userId: string;
  beforeAll(async () => {
    // Reuse existing app; register new user for isolation
    const user = await storage.createUser({ id: 'u-webauthn-mgmt', email: 'mgmt@example.com' } as any);
    userId = user.id;
    // Register one credential
    await api.get('/api/webauthn/register/options').set({ 'x-user-id': userId });
    await api.post('/api/webauthn/register/verify').set({ 'x-user-id': userId }).send({
      id: 'mgmt-cred-id', rawId: 'bXplbXQtdGVzdA', type: 'public-key', response: { clientDataJSON: 'x', attestationObject: 'y' }
    });
  });
  function authHeader() { return { 'x-user-id': userId }; }

  it('lists credentials including the registered one', async () => {
    const list = await api.get('/api/webauthn/credentials').set(authHeader());
    expect(list.status).toBe(200);
    expect(Array.isArray(list.body)).toBe(true);
    expect(list.body.length).toBe(1);
    expect(list.body[0].credentialId).toBeTruthy();
  });
  it('deletes credential and returns success', async () => {
    const list = await api.get('/api/webauthn/credentials').set(authHeader());
    const id = list.body[0].id;
    const del = await api.delete(`/api/webauthn/credentials/${id}`).set(authHeader());
    expect(del.status).toBe(200);
    expect(del.body.success).toBe(true);
    const after = await api.get('/api/webauthn/credentials').set(authHeader());
    expect(after.body.length).toBe(0);
  });
  it('returns 404 when deleting non-existent credential', async () => {
    const del = await api.delete('/api/webauthn/credentials/does-not-exist').set(authHeader());
    expect(del.status).toBe(404);
  });
});

describe('WebAuthn credential rename', () => {
  let userId: string;
  beforeAll(async () => {
    const user = await storage.createUser({ id: 'u-webauthn-rename', email: 'rename@example.com' } as any);
    userId = user.id;
    await api.get('/api/webauthn/register/options').set({ 'x-user-id': userId });
    await api.post('/api/webauthn/register/verify').set({ 'x-user-id': userId }).send({
      id: 'rename-cred-id', rawId: 'cmVuYW1lLWNyZWQ', type: 'public-key', response: { clientDataJSON: 'x', attestationObject: 'y' }
    });
  });
  function authHeader() { return { 'x-user-id': userId }; }

  it('renames credential successfully', async () => {
    const list = await api.get('/api/webauthn/credentials').set(authHeader());
    expect(list.status).toBe(200);
    const id = list.body[0].id;
    const patch = await api.patch(`/api/webauthn/credentials/${id}`).set(authHeader()).send({ name: 'My Key' });
    expect(patch.status).toBe(200);
    expect(patch.body.success).toBe(true);
    const after = await api.get('/api/webauthn/credentials').set(authHeader());
    expect(after.body[0].name).toBe('My Key');
  });

  it('rejects empty name', async () => {
    const list = await api.get('/api/webauthn/credentials').set(authHeader());
    const id = list.body[0].id;
    const patch = await api.patch(`/api/webauthn/credentials/${id}`).set(authHeader()).send({ name: '' });
    expect(patch.status).toBe(400);
  });

  it('rejects too long name', async () => {
    const list = await api.get('/api/webauthn/credentials').set(authHeader());
    const id = list.body[0].id;
    const longName = 'x'.repeat(61);
    const patch = await api.patch(`/api/webauthn/credentials/${id}`).set(authHeader()).send({ name: longName });
    expect(patch.status).toBe(400);
  });

  it('returns 404 for non-existent credential rename', async () => {
    const patch = await api.patch('/api/webauthn/credentials/no-such-id').set(authHeader()).send({ name: 'Test' });
    expect(patch.status).toBe(404);
  });
});
