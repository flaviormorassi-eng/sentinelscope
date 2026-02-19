
import supertest from 'supertest';
import express from 'express';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { registerRoutes } from '../routes';
import { storage } from '../storage';

// 1. Setup Mock for WebAuthn so we can control verification failure
const verifyWebAuthnMock = vi.fn();

vi.mock('@simplewebauthn/server', () => {
    return {
        // Pass-through other functions or mock minimally
        generateRegistrationOptions: () => ({ challenge: 'chal', user: { id: 'u', name: 'n', displayName: 'd' } }),
        verifyRegistrationResponse: () => ({ verified: true, registrationInfo: { credentialID: Buffer.from('cid'), credentialPublicKey: Buffer.from('pk'), counter: 0 } }),
        generateAuthenticationOptions: () => ({ challenge: 'chal', allowCredentials: [] }),
        
        // This is the one we care about
        verifyAuthenticationResponse: (...args: any[]) => verifyWebAuthnMock(...args)
    };
});

const app = express();
app.use(express.json());

describe('MFA WebAuthn Locking', () => {
    let api: any;
    let userId: string;

    beforeEach(async () => {
        // Reset mocks
        verifyWebAuthnMock.mockReset();
        // Return FAILURE by default for this suite
        verifyWebAuthnMock.mockResolvedValue({ verified: false });

        // Setup App
        await registerRoutes(app);
        api = supertest(app);

        // Setup User
        const user = await storage.createUser({ 
            id: `user-${Date.now()}`,
            email: `mfa-lock-${Date.now()}@test.com`, 
            displayName: 'Lock Test' 
        });
        userId = user.id;

        // Setup MFA Profile (must exist to track attempts)
        await storage.upsertUserMfa(userId, { 
            totpEnabled: true, // usually prerequisite
            totpSecretHash: 'stub',
            failedAttempts: 0, 
            lockedUntil: null 
        });

        // Setup a WebAuthn Credential so we can try to verify it
        // Note: Memory storage might not enforce foreign keys or might behave differently
        // But we rely on standard storage interface.
        // Important: `credentialId` usually comes from the client in 'rawId' or 'id' but encoded.
        // Our route uses `body.id` to lookup.
        await storage.createWebAuthnCredential(userId, {
            credentialId: 'cred-id',
            publicKey: 'pub-key',
            signCount: 0,
            name: 'Key 1'
        });

        // Seed the challenge in memory (routes.ts uses in-memory map webauthnChallenges)
        // We trigger the options endpoint to set the challenge
        await api.get('/api/webauthn/auth/options')
            .set('x-user-id', userId)
            .expect(200);
    });

    it('locks account after 5 failed webauthn attempts', async () => {
        const payload = { id: 'cred-id', rawId: 'cred-id', response: {}, type: 'public-key' };

        // Attempt 1-5: Should fail with 400
        for (let i = 1; i <= 5; i++) {
            // Re-request options to refresh challenge if needed? 
            // routes.ts implementation of verify clears auth challenge on success, but maybe not on failure?
            // Actually: "webauthnChallenges.set(userId, { ...auth: undefined });" happens ONLY on success or error catch?
            // Wait, looking at routes.ts: 
            // The challenge check `if (!challenge)` is at top.
            // But verify does `webauthnChallenges.set(..., auth: undefined)` at the end of success path.
            // On failure path (the one I added), it DOES NOT clear the challenge. So we can reuse it (or the client usually would assume one challenge per attempt).
            // Let's assume we can reuse or just re-request options.
            
            // Re-request options just to be safe and realistic (client would retry)
            await api.get('/api/webauthn/auth/options').set('x-user-id', userId);

            const res = await api.post('/api/webauthn/auth/verify')
                .set('x-user-id', userId)
                .send(payload);

            if (res.status === 500) console.error(res.body); // Debug helper

            expect(res.status).toBe(400); // Bad Request (Verification failed)
            expect(res.body.attempts).toBe(i);
        }

        // Attempt 6: Should be LOCKED (423)
        // Even if we provide a valid response now (mocking success)
        verifyWebAuthnMock.mockResolvedValue({ verified: true, authenticationInfo: { newCounter: 1 } });
        
        await api.get('/api/webauthn/auth/options').set('x-user-id', userId);
        
        const resLocked = await api.post('/api/webauthn/auth/verify')
            .set('x-user-id', userId)
            .send(payload);

        expect(resLocked.status).toBe(423); // Locked
        expect(resLocked.body.error).toContain('locked');
    });
});
