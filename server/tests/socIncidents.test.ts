import { describe, it, expect, beforeAll, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

process.env.ALLOW_LEGACY_X_USER_ID = 'true';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'devsecret';

const TEST_USER_ID = 'soc-user';
let monitoringMode: 'demo' | 'real' = 'real';

const realThreatEvents = [
  {
    id: 'ev-email-1',
    userId: TEST_USER_ID,
    createdAt: new Date().toISOString(),
    severity: 'high',
    threatType: 'phishing',
    mitigationStatus: 'detected',
    sourceURL: 'https://phishing.test/inbox',
    sourceIP: '203.0.113.10',
    message: 'Suspicious email link opened',
    metadata: {
      emailFrom: 'attacker@example.com',
      emailSubject: 'Action required',
      sourceURL: 'https://phishing.test/inbox',
      sha256: 'abc123',
    },
  },
  {
    id: 'ev-dns-1',
    userId: TEST_USER_ID,
    createdAt: new Date().toISOString(),
    severity: 'high',
    threatType: 'dns_anomaly',
    mitigationStatus: 'detected',
    sourceIP: '203.0.113.55',
    message: 'Suspicious DNS query detected',
    metadata: {
      dnsQuery: 'this-is-a-very-long-subdomain-value.bad-domain.test',
      dnsQueryType: 'TXT',
      dnsResponseCode: 'NXDOMAIN',
      dnsResolver: '8.8.8.8',
      dnsProtocol: 'doh',
      dnsEncrypted: true,
    },
  },
  {
    id: 'ev-download-1',
    userId: TEST_USER_ID,
    createdAt: new Date().toISOString(),
    severity: 'critical',
    threatType: 'malware',
    mitigationStatus: 'blocked',
    sourceURL: 'https://evil.test/dropper.exe',
    sourceIP: '203.0.113.11',
    message: 'Malicious file download',
    metadata: {
      downloadName: 'dropper.exe',
      localPath: '/Users/test/Downloads/dropper.exe',
      processName: 'Safari',
    },
  },
  {
    id: 'ev-old-1',
    userId: TEST_USER_ID,
    createdAt: Date.now() - (2 * 60 * 60 * 1000),
    severity: 'medium',
    threatType: 'old_event',
    mitigationStatus: 'detected',
    sourceIP: '203.0.113.99',
    message: 'Old event outside 1h window',
    metadata: {
      dnsQuery: 'old-window.bad-domain.test',
    },
  },
];

const demoThreats = [
  {
    id: 'demo-1',
    userId: TEST_USER_ID,
    timestamp: new Date().toISOString(),
    severity: 'medium',
    type: 'suspicious_activity',
    status: 'detected',
    description: 'Demo threat',
    sourceIP: '198.51.100.8',
  },
];

vi.mock('../storage', () => {
  const storage = {
    async getUserPreferences(userId: string) {
      return { userId, monitoringMode };
    },
    async getThreatEvents(userId: string) {
      return realThreatEvents.filter((event) => event.userId === userId);
    },
    async getThreats(userId: string) {
      return demoThreats.filter((threat) => threat.userId === userId);
    },
  };
  return { storage };
});

let registerRoutes: any;
let app: express.Express;
let agent: any;

describe('/api/soc/incidents', () => {
  beforeAll(async () => {
    app = express();
    app.use(express.json());
    const mod = await import('../routes');
    registerRoutes = mod.registerRoutes;
    await registerRoutes(app);
    agent = request(app);
  });

  it('requires authentication', async () => {
    const res = await agent.get('/api/soc/incidents');
    expect(res.status).toBe(401);
  });

  it('returns real incidents with email/download evidence mapping', async () => {
    monitoringMode = 'real';

    const res = await agent
      .get('/api/soc/incidents?hours=24&limit=50')
      .set('x-user-id', TEST_USER_ID)
      .expect(200);

    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.mode).toBe('real');

    const emailIncident = res.body.data.find((item: any) => item.id === 'ev-email-1');
    expect(emailIncident).toBeTruthy();
    expect(emailIncident.sourceType).toBe('email');
    expect(emailIncident.emailFrom).toBe('attacker@example.com');

    const downloadIncident = res.body.data.find((item: any) => item.id === 'ev-download-1');
    expect(downloadIncident).toBeTruthy();
    expect(downloadIncident.sourceType).toBe('download');
    expect(downloadIncident.downloadName).toBe('dropper.exe');
    expect(downloadIncident.localPath).toContain('/Downloads/dropper.exe');

    const dnsIncident = res.body.data.find((item: any) => item.id === 'ev-dns-1');
    expect(dnsIncident).toBeTruthy();
    expect(dnsIncident.sourceType).toBe('dns');
    expect(dnsIncident.dnsQuery).toContain('bad-domain.test');
    expect(dnsIncident.dnsQueryType).toBe('TXT');
    expect(dnsIncident.dnsResponseCode).toBe('NXDOMAIN');
    expect(dnsIncident.dnsResolver).toBe('8.8.8.8');
    expect(dnsIncident.dnsProtocol).toBe('doh');
    expect(dnsIncident.dnsEncrypted).toBe(true);
  });

  it('applies source and severity filters', async () => {
    monitoringMode = 'real';

    const res = await agent
      .get('/api/soc/incidents?source=download&sev=critical')
      .set('x-user-id', TEST_USER_ID)
      .expect(200);

    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].id).toBe('ev-download-1');
  });

  it('returns incidents sorted by newest timestamp first', async () => {
    monitoringMode = 'real';

    const res = await agent
      .get('/api/soc/incidents?hours=24&limit=200')
      .set('x-user-id', TEST_USER_ID)
      .expect(200);

    const timestamps = res.body.data.map((item: any) => Date.parse(String(item.timestamp)));
    const sorted = [...timestamps].sort((a, b) => b - a);
    expect(timestamps).toEqual(sorted);
  });

  it('matches DNS incidents via DNS-specific query fields', async () => {
    monitoringMode = 'real';

    const res = await agent
      .get('/api/soc/incidents?q=8.8.8.8')
      .set('x-user-id', TEST_USER_ID)
      .expect(200);

    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].id).toBe('ev-dns-1');
  });

  it('applies 1-hour window consistently for numeric timestamps', async () => {
    monitoringMode = 'real';

    const res = await agent
      .get('/api/soc/incidents?hours=1')
      .set('x-user-id', TEST_USER_ID)
      .expect(200);

    const ids = res.body.data.map((item: any) => item.id);
    expect(ids).not.toContain('ev-old-1');
    expect(ids).toContain('ev-dns-1');
  });

  it('returns mapped demo incidents in demo mode', async () => {
    monitoringMode = 'demo';

    const res = await agent
      .get('/api/soc/incidents?hours=24')
      .set('x-user-id', TEST_USER_ID)
      .expect(200);

    expect(res.body.mode).toBe('demo');
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].id).toBe('demo-1');
  });
});
