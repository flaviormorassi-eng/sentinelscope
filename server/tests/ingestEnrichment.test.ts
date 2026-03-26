import { describe, it, expect, beforeAll, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_dummy';

const createRawEvent = vi.fn(async (event: any) => ({ id: 'raw-1', ...event }));
const createNormalizedEvent = vi.fn(async (event: any) => ({ id: 'norm-1', ...event }));

vi.mock('../storage', () => {
  const storage = {
    verifyEventSourceApiKey: vi.fn(async (_apiKey: string) => ({
      id: 'src-1',
      userId: 'ingest-user',
      name: 'Agent',
      sourceType: 'agent',
      isActive: true,
    })),
    isIpBlocklisted: vi.fn(async () => false),
    createRawEvent,
    updateEventSourceHeartbeat: vi.fn(async () => undefined),
    getUserPreferences: vi.fn(async () => ({ userId: 'ingest-user', monitoringMode: 'real', dnsDetectionEnabled: true })),
    createNormalizedEvent,
    createThreatEvent: vi.fn(async () => ({ id: 'threat-1' })),
    createAlert: vi.fn(async () => ({ id: 'alert-1' })),
    createSecurityAuditLog: vi.fn(async () => undefined),
  };
  return { storage };
});

let registerRoutes: any;
let app: express.Express;
let server: any;

describe('/api/ingest/events enrichment', () => {
  beforeAll(async () => {
    app = express();
    app.use(express.json());
    const mod = await import('../routes');
    registerRoutes = mod.registerRoutes;
    server = await registerRoutes(app);
  });

  it('merges SOC evidence fields into rawData and fast-track normalized metadata', async () => {
    await request(server)
      .post('/api/ingest/events')
      .set('x-api-key', 'test-key')
      .send({
        severity: 'high',
        eventType: 'malware',
        message: 'Downloaded suspicious file',
        sourceURL: 'https://malicious.test/payload.exe',
        emailFrom: 'attacker@example.com',
        emailSubject: 'Invoice attached',
        downloadName: 'payload.exe',
        localPath: '/Users/test/Downloads/payload.exe',
        processName: 'Mail',
        sha256: 'deadbeef',
        dnsQuery: 'verylongsubdomain-for-dns-test.bad-domain.example',
        dnsQueryType: 'TXT',
        dnsResponseCode: 'NXDOMAIN',
        dnsResolver: '8.8.8.8',
        dnsProtocol: 'doh',
        dnsEncrypted: true,
        rawData: {
          metadata: {
            senderEmail: 'fallback@example.com',
          },
        },
      })
      .expect(201);

    expect(createRawEvent).toHaveBeenCalled();
    const rawArg = createRawEvent.mock.calls[0][0];
    expect(rawArg.rawData.emailFrom).toBe('attacker@example.com');
    expect(rawArg.rawData.downloadName).toBe('payload.exe');
    expect(rawArg.rawData.localPath).toContain('/Downloads/payload.exe');
    expect(rawArg.rawData.dnsQuery).toContain('bad-domain.example');
    expect(rawArg.rawData.dnsQueryType).toBe('TXT');
    expect(rawArg.rawData.dnsResponseCode).toBe('NXDOMAIN');
    expect(rawArg.rawData.dnsResolver).toBe('8.8.8.8');
    expect(rawArg.rawData.dnsProtocol).toBe('doh');
    expect(rawArg.rawData.dnsEncrypted).toBe(true);

    expect(createNormalizedEvent).toHaveBeenCalled();
    const normArg = createNormalizedEvent.mock.calls[0][0];
    expect(normArg.metadata.emailFrom).toBe('attacker@example.com');
    expect(normArg.metadata.emailSubject).toBe('Invoice attached');
    expect(normArg.metadata.downloadName).toBe('payload.exe');
    expect(normArg.metadata.localPath).toBe('/Users/test/Downloads/payload.exe');
    expect(normArg.metadata.processName).toBe('Mail');
    expect(normArg.metadata.sha256).toBe('deadbeef');
    expect(normArg.metadata.dnsQuery).toContain('bad-domain.example');
    expect(normArg.metadata.dnsQueryType).toBe('TXT');
    expect(normArg.metadata.dnsResponseCode).toBe('NXDOMAIN');
    expect(normArg.metadata.dnsResolver).toBe('8.8.8.8');
    expect(normArg.metadata.dnsProtocol).toBe('doh');
    expect(normArg.metadata.dnsEncrypted).toBe(true);
  });
});
