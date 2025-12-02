import { describe, it, expect, beforeAll } from 'vitest';
import express from 'express';
import supertest from 'supertest';

let app: express.Express;
let agent: any;

describe('Health endpoints', () => {
  beforeAll(async () => {
    app = express();
    const mod = await import('../routes');
    await mod.registerRoutes(app);
  agent = supertest(app);
  });

  it('returns ok from /health', async () => {
    const res = await agent.get('/health').expect(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.timestamp).toMatch(/T/);
  });

  it('returns uptime data from /healthz', async () => {
    const res = await agent.get('/healthz').expect(200);
    expect(res.body.ok).toBe(true);
    expect(typeof res.body.uptime).toBe('number');
  });
});
