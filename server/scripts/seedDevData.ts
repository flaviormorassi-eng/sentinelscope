#!/usr/bin/env tsx
import 'dotenv/config';
import { DbStorage } from '../storage';

async function main() {
  const userId = process.argv[2];
  const rawCountArg = process.argv[3];
  const browsingCountArg = process.argv[4];
  const includeAlerts = process.argv.includes('--alerts');
  const includeMediumAlerts = process.argv.includes('--alerts-medium');
  const purgeExisting = process.argv.includes('--purge');
  const autoFlagArgIndex = process.argv.findIndex(a => a.startsWith('--auto-flag='));
  const autoFlagDomains = autoFlagArgIndex >= 0 ? process.argv[autoFlagArgIndex].split('=')[1].split(',').filter(Boolean) : [];
  const purgeCatsArgIndex = process.argv.findIndex(a => a.startsWith('--purge-cats='));
  const purgeCategories = purgeCatsArgIndex >= 0 ? process.argv[purgeCatsArgIndex].split('=')[1].split(',').filter(Boolean) : [];
  if (!userId) {
    console.error('Usage: npx tsx server/scripts/seedDevData.ts <userId> [rawCount] [browsingCount]');
    process.exit(1);
  }
  const rawCount = rawCountArg ? parseInt(rawCountArg, 10) : 12;
  const browsingCount = browsingCountArg ? parseInt(browsingCountArg, 10) : 20;
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL missing in environment. Add it to .env first.');
    process.exit(1);
  }
  const storage = new DbStorage();
  const user = await storage.getUser(userId);
  if (!user) {
    console.log(`Creating user ${userId}`);
    await storage.createUser({ id: userId, email: `${userId}@example.dev` });
  }
  let prefs = await storage.getUserPreferences(userId);
  if (!prefs || !prefs.browsingMonitoringEnabled || !prefs.browsingHistoryEnabled || !prefs.browsingConsentGivenAt) {
    await storage.upsertUserPreferences({
      userId,
      emailNotifications: true,
      pushNotifications: true,
      alertThreshold: 'medium',
      monitoringMode: 'real',
      trialStartedAt: null,
      trialExpiresAt: null,
      browsingMonitoringEnabled: true,
      browsingHistoryEnabled: true,
      browsingConsentGivenAt: new Date(),
      flaggedOnlyDefault: false,
    });
  }
  let sources = await storage.getEventSources(userId);
  if (!sources || sources.length === 0) {
    const { generateApiKey, hashApiKey } = await import('../utils/security');
    const apiKey = generateApiKey();
    const apiKeyHash = hashApiKey(apiKey);
    const created = await storage.createEventSource({
      userId,
      name: 'Seed Script Source',
      sourceType: 'agent',
      description: 'Created by seedDevData.ts',
      apiKeyHash,
      isActive: true,
      metadata: { seedScript: true }
    } as any);
    sources = [created as any];
    console.log('Event source created (apiKey not stored retrievably)');
  }
  const source = sources[0];
  if (purgeExisting) {
    console.log('Purging existing seed data for user...');
    try {
      const purged = await (storage as any).purgeUserSeedData?.(userId, purgeCategories);
      console.log('Purged:', purged);
    } catch (e) {
      console.warn('Purge failed (continuing):', (e as any)?.message);
    }
  }
  console.log(`Seeding ${rawCount} raw events... (alerts=${includeAlerts ? 'on' : 'off'}, mediumAlerts=${includeMediumAlerts ? 'on' : 'off'})`);
  for (let i = 0; i < rawCount; i++) {
    const sev = ['low','medium','high','critical'][Math.floor(Math.random()*4)];
    const rawData = {
      eventType: 'network_flow',
      severity: sev,
      message: Math.random() < 0.35 ? 'Suspicious pattern observed' : 'Normal flow sample',
      sourceIP: `10.0.${Math.floor(Math.random()*40)}.${Math.floor(1+Math.random()*250)}`,
      destinationIP: `192.168.${Math.floor(Math.random()*40)}.${Math.floor(1+Math.random()*250)}`,
      deviceName: Math.random() < 0.5 ? 'Workstation-A' : 'Server-B',
      threatVector: Math.random() < 0.25 ? 'network' : null,
      timestamp: new Date().toISOString(),
    };
    await storage.createRawEvent({ sourceId: (source as any).id, userId, rawData } as any);
  }
  console.log(`Seeding ${browsingCount} browsing activity records...`);
  const sampleDomains = ['example.com','malicious.test','docs.internal','portal.company','updates.service'];
  const browsers = ['Chrome','Firefox','Edge','Safari'];
  const paths = ['/','/login','/dashboard','/download','/search?q=test'];
  for (let i=0;i<browsingCount;i++) {
    const domain = sampleDomains[Math.floor(Math.random()*sampleDomains.length)];
    const browser = browsers[Math.floor(Math.random()*browsers.length)];
    const path = paths[Math.floor(Math.random()*paths.length)];
    const flagged = domain === 'malicious.test' && Math.random() < 0.6;
    await storage.createBrowsingActivity({
      userId,
      domain,
      fullUrl: `https://${domain}${path}`,
      browser,
      protocol: 'https',
      ipAddress: null,
      sourceId: (source as any).id,
      metadata: flagged ? { testFlag: true } : null,
    } as any);
  }
  const { runEventProcessor } = await import('../eventProcessor');
  await runEventProcessor();
  const threatEvents = await storage.getThreatEvents(userId, 50);
  let alertsCreated = 0;
  if (includeAlerts) {
    for (const te of threatEvents) {
      const sev = (te as any).severity?.toLowerCase();
      const eligible = sev === 'high' || sev === 'critical' || (includeMediumAlerts && sev === 'medium');
      if (eligible) {
        await storage.createAlert({
          userId,
          title: `Threat ${sev.toUpperCase()} detected`,
          message: (te as any).description || 'Seed script alert',
          severity: sev,
          threatId: (te as any).id || null,
          read: false,
        } as any);
        alertsCreated++;
      }
    }
  }
  let domainsFlagged: string[] = [];
  for (const d of autoFlagDomains) {
    try {
      await storage.flagDomain(userId, d);
      domainsFlagged.push(d);
    } catch {}
  }
  const browsingStats = await storage.getBrowsingStats(userId);
  console.log(JSON.stringify({
    rawEventsCreated: rawCount,
    threatEventsCount: threatEvents.length,
    browsingCreated: browsingCount,
    browsingStats,
    alertsCreated,
    domainsFlagged,
    purgeExecuted: purgeExisting,
    includeMediumAlerts,
    purgeCategories
  }, null, 2));
  process.exit(0);
}

main().catch(err => {
  console.error('Seed script error:', err);
  process.exit(1);
});
