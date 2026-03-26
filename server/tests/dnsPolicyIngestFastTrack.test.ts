import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_dummy';

const createRawEvent = vi.fn(async (event: any) => ({ id: 'raw-1', ...event }));
const createNormalizedEvent = vi.fn(async (event: any) => ({ id: 'norm-1', ...event }));
const createThreatEvent = vi.fn(async () => ({ id: 'threat-1' }));

let dnsDetectionEnabled = true;

vi.mock('../storage', () => {
  const storage = {
    verifyEventSourceApiKey: vi.fn(async (_apiKey: string) => ({
      id: 'src-1',
      userId: 'ingest-user',
      name: 'Agent',
      sourceType: 'agent',
      isActive: true,
    })),
    getUserPreferences: vi.fn(async () => ({ userId: 'ingest-user', monitoringMode: 'real', dnsDetectionEnabled })),
    isIpBlocklisted: vi.fn(async () => false),
    createRawEvent,
    updateEventSourceHeartbeat: vi.fn(async () => undefined),
    createNormalizedEvent,
    createThreatEvent,
    createAlert: vi.fn(async () => ({ id: 'alert-1' })),
    createSecurityAuditLog: vi.fn(async () => undefined),
  };
  return { storage };
});

let registerRoutes: any;
let app: express.Express;
let agent: any;

describe('/api/ingest/events fast-track respects DNS policy', () => {
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
    dnsDetectionEnabled = true;
  });

  it('skips fast-track threat creation for DNS events when dnsDetectionEnabled is false', async () => {
    dnsDetectionEnabled = false;

    await agent
      .post('/api/ingest/events')
      .set('x-api-key', 'test-key')
      .send({
        severity: 'high',
        eventType: 'dns_query',
        message: 'DNS suspicious event',
        dnsQuery: 'disabled-fast-track.bad-domain.test',
        dnsQueryType: 'TXT',
        dnsResponseCode: 'NXDOMAIN',
        dnsResolver: '9.9.9.9',
        dnsProtocol: 'doh',
        dnsEncrypted: true,
        rawData: {},
      })
      .expect(201);

    expect(createRawEvent).toHaveBeenCalled();
    expect(createNormalizedEvent).not.toHaveBeenCalled();
    expect(createThreatEvent).not.toHaveBeenCalled();
  });

  it('keeps fast-track threat creation for DNS events when dnsDetectionEnabled is true', async () => {
    dnsDetectionEnabled = true;

    await agent
      .post('/api/ingest/events')
      .set('x-api-key', 'test-key')
      .send({
        severity: 'high',
        eventType: 'dns_query',
        message: 'DNS suspicious event',
        dnsQuery: 'enabled-fast-track.bad-domain.test',
        dnsQueryType: 'TXT',
        dnsResponseCode: 'NXDOMAIN',
        dnsResolver: '9.9.9.9',
        dnsProtocol: 'doh',
        dnsEncrypted: true,
        rawData: {},
      })
      .expect(201);

    expect(createRawEvent).toHaveBeenCalled();
    expect(createNormalizedEvent).toHaveBeenCalled();
    expect(createThreatEvent).toHaveBeenCalled();
  });
});
