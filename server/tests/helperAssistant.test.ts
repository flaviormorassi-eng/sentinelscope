import { describe, it, expect, beforeAll, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

process.env.ALLOW_LEGACY_X_USER_ID = 'true';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'devsecret';
process.env.OPENAI_API_KEY = '';
process.env.HELPER_ASSISTANT_RATE_LIMIT_PER_MIN = '2';

vi.mock('../storage', () => ({
  storage: {
    async createSecurityAuditLog() {
      return null;
    },
  },
}));

let registerRoutes: any;
let app: express.Express;
let agent: any;

describe('/api/helper/assistant', () => {
  beforeAll(async () => {
    app = express();
    app.use(express.json());
    const mod = await import('../routes');
    registerRoutes = mod.registerRoutes;
    await registerRoutes(app);
    agent = request(app);
  });

  it('requires authentication', async () => {
    const res = await agent.post('/api/helper/assistant').send({ question: 'How to run safely?' });
    expect(res.status).toBe(401);
  });

  it('returns safe fallback guidance with commands and checklist', async () => {
    const res = await agent
      .post('/api/helper/assistant')
      .set('x-user-id', 'helper-user')
      .send({ question: 'How do I implement API endpoints and run safely?', language: 'en' })
      .expect(200);

    expect(typeof res.body.answer).toBe('string');
    expect(Array.isArray(res.body.commands)).toBe(true);
    expect(res.body.commands.length).toBeGreaterThan(0);
    expect(Array.isArray(res.body.safetyChecklist)).toBe(true);
    expect(res.body.poweredByAi).toBe(false);
  });

  it('validates payload', async () => {
    const res = await agent
      .post('/api/helper/assistant')
      .set('x-user-id', 'helper-user')
      .send({ question: 'ok' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid request payload');
  });

  it('enforces per-user rate limit', async () => {
    const userId = 'helper-rate-user';
    await agent
      .post('/api/helper/assistant')
      .set('x-user-id', userId)
      .send({ question: 'How do I run safely?', language: 'en' })
      .expect(200);

    await agent
      .post('/api/helper/assistant')
      .set('x-user-id', userId)
      .send({ question: 'How do I implement API safely?', language: 'en' })
      .expect(200);

    const limited = await agent
      .post('/api/helper/assistant')
      .set('x-user-id', userId)
      .send({ question: 'How do I validate before deploy?', language: 'en' })
      .expect(429);

    expect(limited.body.error).toContain('Rate limit exceeded');
    expect(typeof limited.body.retryAfterSeconds).toBe('number');
  });
});
