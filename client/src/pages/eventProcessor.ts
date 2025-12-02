import { storage } from '../storage';
import { getGeolocation } from '../utils/geolocationService';
import { analyzeEvent } from '../utils/threatIntelService';
import type { RawEvent, InsertNormalizedEvent, NormalizedEvent } from '@shared/schema';

const BATCH_SIZE = 100;

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
      timestamp: rawData.timestamp ? new Date(rawData.timestamp) : new Date(),
      metadata: rawData.metadata || {},
      sourceURL: rawData.sourceURL,
      deviceName: rawData.deviceName,
      threatVector: rawData.threatVector,
    };

    // IP Enrichment
    const sourceIp = rawData.sourceIp || rawData.sourceIP;
    if (sourceIp) {
      normalized.sourceIP = sourceIp;
      const geoData = await getGeolocation(sourceIp);
      if (geoData) {
        normalized.sourceCountry = geoData.country;
        normalized.sourceCity = geoData.city;
        normalized.sourceLat = geoData.lat;
        normalized.sourceLon = geoData.lon;
      }
    }

    const destinationIp = rawData.destinationIp || rawData.destinationIP;
    if (destinationIp) {
      normalized.destinationIP = destinationIp;
    }

    // Save the normalized event first to get its ID
    const createdNormalizedEvent = await storage.createNormalizedEvent(normalized);

    // --- Threat Detection Logic ---
    const threatSignature = analyzeEvent(createdNormalizedEvent);

    if (threatSignature) {
      console.log(`[Processor] Threat detected for event ${createdNormalizedEvent.id}: ${threatSignature.name}`);
      // Mark the normalized event as a threat
      await storage.flagNormalizedEventAsThreat(createdNormalizedEvent.id);

      // Create a corresponding threat_event record
      const newThreatEvent = await storage.createThreatEvent({
        normalizedEventId: createdNormalizedEvent.id,
        userId: event.userId,
        threatType: threatSignature.type,
        severity: threatSignature.severity,
        confidence: threatSignature.confidence,
        // Other fields like sourceURL, deviceName can be added here if needed
      });

      // Create an alert for the new threat event
      await storage.createAlert({
        userId: event.userId,
        title: `New Threat Detected: ${threatSignature.name}`,
        message: createdNormalizedEvent.message || `A ${threatSignature.severity} threat was detected.`,
        severity: threatSignature.severity,
        // Other fields like sourceURL, deviceName can be added here if needed
      });
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

// This allows the script to be run directly from the command line
if (require.main === module) {
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