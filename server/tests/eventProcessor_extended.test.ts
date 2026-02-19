
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import express from 'express';
import type { DbStorage } from '../storage';

// 1. Hoisted Data Stores and Mock
const { mockStorage, stores } = vi.hoisted(() => {
    const usersStore = new Map();
    const prefsStore = new Map();
    const sourcesStore = new Map();
    const rawEventsStore: any[] = [];
    const normalizedStore: any[] = [];
    const threatsStore: any[] = [];
    const alertsStore: any[] = [];

    const storage = {
        async createUser(u: any) { const id = u.id || `user-${Date.now()}`; usersStore.set(id, { ...u, id }); return usersStore.get(id); },
        async getUser(id: string) { return usersStore.get(id); },
        async upsertUserPreferences(p: any) { prefsStore.set(p.userId, { ...prefsStore.get(p.userId), ...p }); return prefsStore.get(p.userId); },
        async getUserPreferences(uid: string) { return prefsStore.get(uid); },
        
        async createEventSource(s: any) { 
            const id = `src-${Date.now()}`; 
            const entry = { id, ...s }; 
            sourcesStore.set(id, entry); 
            return entry; 
        },
        
        async createRawEvent(e: any) {
            const id = `raw-${rawEventsStore.length + 1}`;
            const entry = { id, ...e, processed: false };
            rawEventsStore.push(entry);
            return entry;
        },
        async getUnprocessedRawEvents(limit: number) {
            return rawEventsStore.filter(e => !e.processed).slice(0, limit);
        },
        async markRawEventAsProcessed(id: string) {
            const ev = rawEventsStore.find(e => e.id === id);
            if (ev) ev.processed = true;
        },

        async createNormalizedEvent(n: any) {
            const id = `norm-${normalizedStore.length + 1}`;
            const entry = { id, ...n, isThreat: false };
            normalizedStore.push(entry);
            return entry;
        },
        async flagNormalizedEventAsThreat(id: string) {
            const ev = normalizedStore.find(e => e.id === id);
            if (ev) ev.isThreat = true;
        },
        async getNormalizedEvents(userId: string) {
            return normalizedStore.filter(e => e.userId === userId);
        },

        async checkIpBlocklist(ip: string) { return undefined; },

        async createThreatEvent(t: any) {
            const id = `threat-${threatsStore.length + 1}`;
            const entry = { id, ...t, createdAt: new Date() };
            threatsStore.push(entry);
            return entry;
        },
        async getRecentThreatEvents(userId: string) {
            return threatsStore.filter(t => t.userId === userId);
        },

        async createAlert(a: any) {
            const id = `alert-${alertsStore.length + 1}`;
            const entry = { id, ...a };
            alertsStore.push(entry);
            return entry;
        }
    };

    return { 
        mockStorage: storage, 
        stores: { 
            usersStore, prefsStore, sourcesStore, rawEventsStore, normalizedStore, threatsStore, alertsStore 
        } 
    };
});

// 2. Apply Mock
vi.mock('../storage', () => ({
  storage: mockStorage,
  DbStorage: class {} // Stub class
}));

// 3. Import SUT (System Under Test) AFTER mock
import { runEventProcessor } from '../eventProcessor';

describe('Extended Event Processor Detection', () => {
    let userId: string;
    let sourceId: string;

    beforeEach(async () => {
        // Reset stores
        stores.usersStore.clear();
        stores.prefsStore.clear();
        stores.sourcesStore.clear();
        stores.rawEventsStore.length = 0;
        stores.normalizedStore.length = 0;
        stores.threatsStore.length = 0;
        stores.alertsStore.length = 0;

        // Setup User
        const user = await mockStorage.createUser({
            email: 'test@example.com',
            displayName: 'Tester'
        });
        userId = user.id;

        // Setup Prefs (Real Mode)
        await mockStorage.upsertUserPreferences({
            userId,
            monitoringMode: 'real'
        });

        // Setup Source
        const source = await mockStorage.createEventSource({
            userId,
            name: 'API Source',
            sourceType: 'API'
        });
        sourceId = source.id;
    });

    async function processAndVerify(message: string, expectedType: string, expectedSeverity: string) {
        // Insert Raw Event
        const raw = await mockStorage.createRawEvent({
            sourceId,
            userId,
            rawData: {
                eventType: 'log',
                severity: 'info',
                message: message,
                sourceIp: '1.2.3.4',
                destinationIp: '5.6.7.8',
                timestamp: new Date().toISOString()
            }
        });

        // Run Processor
        await runEventProcessor();

        // Verify Normalized Event
        const normalized = stores.normalizedStore.find((n: any) => n.rawEventId === raw.id);
        expect(normalized, 'Normalized event should be created').toBeDefined();
        
        // Check if threat detected
        expect(normalized.isThreat, `Event with message "${message}" should be flagged as threat`).toBe(true);
        expect(stores.threatsStore.length).toBeGreaterThan(0);
        
        const threat = stores.threatsStore.find((t: any) => t.normalizedEventId === normalized.id);
        expect(threat, 'Threat event record should exist').toBeDefined();
        expect(threat.threatType).toBe(expectedType);
        expect(threat.severity).toBe(expectedSeverity);
    }


  it('detects Command Injection', async () => {
    await processAndVerify('User tried to execute ; cat /etc/passwd', 'Command Injection', 'critical');
  });

  it('detects Path Traversal', async () => {
    await processAndVerify('GET /../../boot.ini HTTP/1.1', 'Path Traversal', 'high');
  });

  it('detects Sensitive File Access', async () => {
    await processAndVerify('Access to .env file was attempted', 'Sensitive File Access', 'critical');
  });

  it('detects Scanner Activity', async () => {
    await processAndVerify('User-Agent: sqlmap/1.4.7', 'Scanner Activity', 'medium');
  });

  it('detects SQL Injection (Extended)', async () => {
    await processAndVerify('input: select * from users where id = 1 or 1=1', 'SQL Injection', 'high');
  });
  
  it('detects XSS (Extended)', async () => {
    await processAndVerify('<img src=x onerror=alert(1)>', 'XSS Attack', 'high');
  });

});
