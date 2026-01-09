import { storage } from './storage';
import { getGeolocation } from './utils/geolocationService';
import { generateMockThreat } from './utils/threatGenerator';
import { checkIPAddress } from './utils/virusTotalService';
import type { RawEvent, InsertNormalizedEvent, NormalizedEvent } from '@shared/schema';

const BATCH_SIZE = 100;

// Helper to check for private IPs
function isPrivateIP(ip: string): boolean {
  return /^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|127\.)/.test(ip);
}

async function detectThreats(normalized: InsertNormalizedEvent): Promise<{ type: string; severity: string } | null> {
  // 1. Check VirusTotal if IP is public and available
  if (normalized.destinationIP && !isPrivateIP(normalized.destinationIP)) {
     try {
       const vtResult = await checkIPAddress(normalized.destinationIP);
       if (vtResult && vtResult.malicious > 0) {
         return { type: 'Malicious IP (VirusTotal)', severity: 'critical' };
       }
     } catch (e) {
       console.error('VT check failed', e);
     }
  }

  // 2. Check keywords in message
  const msg = normalized.message?.toLowerCase() || '';
  if (msg.includes('failed login') || msg.includes('authentication failure')) {
    return { type: 'Brute Force Attempt', severity: 'medium' };
  }
  if (msg.includes('sql syntax') || msg.includes('union select')) {
    return { type: 'SQL Injection', severity: 'high' };
  }
  if (msg.includes('xss') || msg.includes('script>')) {
    return { type: 'XSS Attack', severity: 'high' };
  }

  // 3. Check threat vector from source
  if (normalized.threatVector) {
      return { type: normalized.threatVector, severity: normalized.severity || 'medium' };
  }

  return null;
}

async function processRawEvent(event: RawEvent) {
  console.log(`[Processor] Processing raw event ${event.id} from source ${event.sourceId}`);

  try {
    const rawData = event.rawData as Record<string, any>;

    // Basic normalization
    const normalized: InsertNormalizedEvent = {
      rawEventId: event.id,
      sourceId: event.sourceId,
      userId: event.userId,
      eventType: rawData.eventType || 'unknown',
      severity: rawData.severity || 'low',
      message: rawData.message || 'No message provided',
      metadata: rawData.metadata || {},
      sourceURL: rawData.sourceURL,
      deviceName: rawData.deviceName,
      threatVector: rawData.threatVector,
      // Use timestamp only if present and valid
      ...(rawData.timestamp ? { timestamp: new Date(rawData.timestamp) } : {}),
    };

    // IP Enrichment
    const sourceIp = rawData.sourceIp || rawData.sourceIP;
    if (sourceIp) {
      normalized.sourceIP = sourceIp;
      const geoData = await getGeolocation(sourceIp);
      if (geoData) {
        normalized.sourceCountry = geoData.country;
        normalized.sourceCity = geoData.city;
        if ('lat' in geoData) normalized.sourceLat = String(geoData.lat);
        if ('lon' in geoData) normalized.sourceLon = String(geoData.lon);
      }
    }

    const destinationIp = rawData.destinationIp || rawData.destinationIP;
    if (destinationIp) {
      normalized.destinationIP = destinationIp;
    }

    // Save the normalized event first to get its ID
    const createdNormalizedEvent = await storage.createNormalizedEvent(normalized);

    // --- Threat Detection Logic ---
    const preferences = await storage.getUserPreferences(event.userId);
    const isDemoMode = preferences?.monitoringMode === 'demo';

    let threatSignature: { type: string; severity: string } | null = null;

    if (isDemoMode) {
      // Use mock threat generator for demo mode
      const mock = generateMockThreat(event.userId, normalized.destinationIP || '192.168.1.1');
      if (mock) {
        threatSignature = { type: mock.type, severity: mock.severity };
      }
    } else {
      // Use real detection logic
      threatSignature = await detectThreats(normalized);
    }

    if (threatSignature) {
      console.log(`[Processor] Threat detected for event ${createdNormalizedEvent.id}: ${threatSignature.type}`);
      // Mark the normalized event as a threat
      await storage.flagNormalizedEventAsThreat(createdNormalizedEvent.id);

      // Create a corresponding threat_event record
      const newThreatEvent = await storage.createThreatEvent({
        normalizedEventId: createdNormalizedEvent.id,
        userId: event.userId,
        threatType: threatSignature.type,
        severity: threatSignature.severity,
        confidence: 1, // default value for mock
        // Other fields like sourceURL, deviceName can be added here if needed
      });

      // Create an alert for the new threat event
      const newAlert = await storage.createAlert({
        userId: event.userId,
        title: `New Threat Detected: ${threatSignature.type}`,
        message: createdNormalizedEvent.message || `A ${threatSignature.severity} threat was detected.`,
        severity: threatSignature.severity,
        // Other fields like sourceURL, deviceName can be added here if needed
      });

      // --- Email Notification Logic ---
      // Send an email if the alert is critical and user has notifications enabled
      if (newAlert.severity === 'critical') {
        const user = await storage.getUser(event.userId);
        if (user) {
          const preferences = await storage.getUserPreferences(user.id);
          if (preferences?.emailNotifications) {
            console.log(`[Processor] Would send critical alert email to ${user.email}`);
            // await sendCriticalAlertEmail(user, newAlert);
          }
        }
      }
    }
    
    // Mark the raw event as processed
    await storage.markRawEventAsProcessed(event.id);

    console.log(`[Processor] Successfully processed event ${event.id}`);
  } catch (error) {
    console.error(`[Processor] Failed to process event ${event.id}:`, error);
    // Optionally, implement a dead-letter queue or retry mechanism here
  }
}

export async function runEventProcessor() {
  console.log('[Processor] Starting event processing cycle...');

  try {
    const unprocessedEvents = await storage.getUnprocessedRawEvents(BATCH_SIZE);

    if (unprocessedEvents.length === 0) {
      console.log('[Processor] No new events to process.');
      return;
    }

    console.log(`[Processor] Found ${unprocessedEvents.length} events to process.`);

    // Process events in parallel
    await Promise.all(unprocessedEvents.map(processRawEvent));

    console.log('[Processor] Event processing cycle finished.');
  } catch (error) {
    console.error('[Processor] An error occurred during the processing cycle:', error);
  }
}

// Standalone run for ES modules
// To run standalone: node --loader tsx server/eventProcessor.ts
if (typeof process !== 'undefined' && process.argv[1] && process.argv[1].endsWith('eventProcessor.ts')) {
  runEventProcessor()
    .then(() => {
      console.log('[Processor] Script finished successfully.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('[Processor] Script failed with an error:', error);
      process.exit(1);
    });
}