import { describe, it, expect, beforeAll, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

process.env.ALLOW_LEGACY_X_USER_ID = 'true';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'devsecret';
process.env.OPENAI_API_KEY = '';
process.env.AI_CHAT_RATE_LIMIT_PER_MIN = '20';
process.env.AI_TENANT_POLICY_JSON = JSON.stringify({
  'ai-user': 'prefilled_actions',
});

vi.mock('../storage', () => ({
  storage: {
    async createSecurityAuditLog() {
      return null;
    },
    async getThreatById(id: string) {
      if (id === 'threat-owned') {
        return {
          id: 'threat-owned',
          userId: 'ai-user',
          timestamp: new Date(),
          severity: 'high',
          type: 'phishing',
          sourceIP: '10.0.0.1',
          targetIP: '10.0.0.2',
          status: 'detected',
          description: 'Suspicious phishing activity',
          blocked: false,
        };
      }
      if (id === 'threat-other-user') {
        return {
          id: 'threat-other-user',
          userId: 'another-user',
          timestamp: new Date(),
          severity: 'critical',
          type: 'malware',
          sourceIP: '10.0.0.8',
          targetIP: '10.0.0.9',
          status: 'detected',
          description: 'Malware signal',
          blocked: false,
        };
      }
      return undefined;
    },
    async getThreatEventById() {
      return undefined;
    },
    async getAlerts() {
      return [];
    },
    async getRecentThreats() {
      return [];
    },
    async getRecentThreatEventsLimit() {
      return [];
    },
    async getRecentAlerts() {
      return [];
    },
  },
}));

let registerRoutes: any;
let app: express.Express;
let agent: any;

describe('/api/ai/chat', () => {
  beforeAll(async () => {
    app = express();
    app.use(express.json());
    const mod = await import('../routes');
    registerRoutes = mod.registerRoutes;
    await registerRoutes(app);
    agent = request(app);
  });

  it('requires authentication', async () => {
    const res = await agent.post('/api/ai/chat').send({ message: 'Assess this event.' });
    expect(res.status).toBe(401);
  });

  it('returns assessment with human-decision status when AI key is unavailable', async () => {
    const res = await agent
      .post('/api/ai/chat')
      .set('x-user-id', 'ai-user')
      .send({ message: 'Analyze this threat quickly', language: 'en', threatId: 'threat-owned' })
      .expect(200);

    expect(typeof res.body.summary).toBe('string');
    expect(['low', 'medium', 'high', 'critical']).toContain(res.body.riskLevel);
    expect(res.body.recommendation?.status).toBe('awaiting_human_decision');
    expect(res.body.poweredByAi).toBe(false);
    expect(res.body.enforcement?.executed).toBe(false);
    expect(res.body.advisoryNotice).toBe(
      'This recommendation is advisory only and requires user approval before any enforcement action is taken.',
    );
    expect(res.body.tenantPolicy?.mode).toBe('prefilled_actions');
    expect(res.body.tenantPolicy?.humanConfirmationRequired).toBe(true);
    expect(res.body.actionDraft?.requiresHumanConfirmation).toBe(true);
  });

  it('enforces ownership checks for threat context', async () => {
    const res = await agent
      .post('/api/ai/chat')
      .set('x-user-id', 'ai-user')
      .send({ message: 'Analyze this other threat', language: 'en', threatId: 'threat-other-user' });

    expect(res.status).toBe(403);
  });

  it('validates payload', async () => {
    const res = await agent
      .post('/api/ai/chat')
      .set('x-user-id', 'ai-user')
      .send({ message: 'ok' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid request payload');
  });
});