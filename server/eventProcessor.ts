import { storage } from './storage';
import { getGeolocation } from './utils/geolocationService';
import { generateMockThreat } from './utils/threatGenerator';
import { checkIPAddress } from './utils/virusTotalService';
import type { RawEvent, InsertNormalizedEvent, NormalizedEvent } from '@shared/schema';

const BATCH_SIZE = 500; // Increased throughput for real-time processing

// Helper to check for private IPs
function isPrivateIP(ip: string): boolean {
  return /^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|127\.)/.test(ip);
}

const THREAT_PATTERNS = [
  { type: 'Brute Force Attempt', severity: 'medium', keywords: ['failed login', 'authentication failure', 'invalid password', 'bad credentials', 'login failed'] },
  { type: 'SQL Injection', severity: 'high', keywords: ['sql syntax', 'union select', '1=1', 'database error', 'information_schema', 'select * from', 'drop table'] },
  { type: 'XSS Attack', severity: 'high', keywords: ['xss', '<script>', 'javascript:', 'onerror=', 'onload=', 'alert('] },
  { type: 'Command Injection', severity: 'critical', keywords: ['; cat ', '| wget', '| curl', '$(', '; ls', 'powershell -encodedcommand'] },
  { type: 'Path Traversal', severity: 'high', keywords: ['../', '..\\', '/etc/passwd', 'c:\\windows\\', 'boot.ini', 'win.ini'] },
  { type: 'Sensitive File Access', severity: 'critical', keywords: ['.env', 'wp-config.php', 'id_rsa', '.git/config'] },
  { type: 'Scanner Activity', severity: 'medium', keywords: ['sqlmap', 'nikto', 'nmap', 'burp collab', 'acunetix', 'nessus', 'gobuster'] },
];

async function detectThreats(normalized: InsertNormalizedEvent, preferences?: any): Promise<{ type: string; severity: string } | null> {
  const metadata = (normalized.metadata && typeof normalized.metadata === 'object') ? normalized.metadata as Record<string, any> : {};
  const dnsQuery = String(metadata.dnsQuery || metadata.domain || metadata.queryName || '').toLowerCase();
  const dnsType = String(metadata.dnsQueryType || metadata.queryType || '').toUpperCase();
  const dnsResponseCode = String(metadata.dnsResponseCode || metadata.responseCode || metadata.rcode || '').toUpperCase();
  const dnsProtocol = String(metadata.dnsProtocol || metadata.protocol || '').toLowerCase();
  const dnsEncrypted = metadata.dnsEncrypted === true || /doh|dot|doq/.test(dnsProtocol);
  const dnsResolver = String(metadata.dnsResolver || metadata.resolver || metadata.resolverIp || '').trim();

  const trustedResolversFromPrefs = typeof preferences?.trustedDnsResolvers === 'string'
    ? preferences.trustedDnsResolvers
    : '';
  const trustedResolvers = (trustedResolversFromPrefs || process.env.TRUSTED_DNS_RESOLVERS || '')
    .split(',')
    .map((value: string) => value.trim())
    .filter(Boolean);
  const dnsDetectionEnabled = preferences?.dnsDetectionEnabled !== false;

  if (!dnsDetectionEnabled) {
    return null;
  }

  // DNS Detection #1: suspicious tunneling-like query structure
  if (dnsQuery) {
    const labels = dnsQuery.split('.').filter(Boolean);
    const longestLabel = labels.reduce((max, label) => Math.max(max, label.length), 0);
    const highEntropyLike = /[a-z0-9]{24,}/i.test(dnsQuery);
    if (longestLabel >= 40 || labels.length >= 6 || (highEntropyLike && (dnsType === 'TXT' || dnsType === 'NULL'))) {
      return { type: 'DNS Tunneling Suspected', severity: 'high' };
    }
  }

  // DNS Detection #2: repeated NXDOMAIN-like suspicious resolution events
  if (dnsResponseCode === 'NXDOMAIN' && dnsQuery) {
    return { type: 'Suspicious DNS NXDOMAIN Activity', severity: 'medium' };
  }

  // DNS Detection #3: encrypted DNS resolver bypass attempt (DoH/DoT/DoQ)
  if (dnsEncrypted && dnsResolver && trustedResolvers.length > 0 && !trustedResolvers.includes(dnsResolver)) {
    return { type: 'Unauthorized Encrypted DNS Resolver', severity: 'high' };
  }

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

  // 2. Check keywords in message against defined patterns
  const msg = normalized.message?.toLowerCase() || '';
  
  for (const pattern of THREAT_PATTERNS) {
    if (pattern.keywords.some(k => msg.includes(k))) {
      return { type: pattern.type, severity: pattern.severity };
    }
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
    const conn = (rawData?.connection && typeof rawData.connection === 'object') ? rawData.connection : {};
    const rawMetadata = rawData?.metadata && typeof rawData.metadata === 'object' ? rawData.metadata : {};
    const pickString = (...values: any[]) => {
      for (const value of values) {
        if (typeof value === 'string' && value.trim().length > 0) return value.trim();
      }
      return undefined;
    };

    const enrichedMetadata = {
      ...rawMetadata,
      emailFrom: pickString(rawData.emailFrom, rawData.senderEmail, rawData.from, rawMetadata.emailFrom, rawMetadata.senderEmail),
      emailSubject: pickString(rawData.emailSubject, rawData.subject, rawMetadata.emailSubject, rawMetadata.subject),
      downloadName: pickString(rawData.downloadName, rawData.fileName, rawData.filename, rawData.file, rawMetadata.downloadName, rawMetadata.fileName, rawMetadata.filename),
      localPath: pickString(rawData.localPath, rawData.path, rawData.filePath, rawData.location, rawData.downloadPath, rawMetadata.localPath, rawMetadata.path, rawMetadata.filePath, rawMetadata.location),
      processName: pickString(rawData.processName, rawData.process, rawData.processPath, rawMetadata.processName, rawMetadata.process, rawMetadata.processPath),
      sha256: pickString(rawData.sha256, rawData.hash, rawData.fileHash, rawMetadata.sha256, rawMetadata.hash, rawMetadata.fileHash),
      email: (rawData.email && typeof rawData.email === 'object') ? rawData.email : rawMetadata.email,
      download: (rawData.download && typeof rawData.download === 'object') ? rawData.download : rawMetadata.download,
      process: (rawData.process && typeof rawData.process === 'object') ? rawData.process : rawMetadata.process,
      sourceURL: pickString(rawData.sourceURL, rawData.sourceUrl, rawData.url, rawMetadata.sourceURL, rawMetadata.sourceUrl, rawMetadata.url),
      dnsQuery: pickString(rawData.dnsQuery, rawData.domain, rawData.queryName, rawMetadata.dnsQuery, rawMetadata.domain, rawMetadata.queryName),
      dnsQueryType: pickString(rawData.dnsQueryType, rawData.queryType, rawMetadata.dnsQueryType, rawMetadata.queryType),
      dnsResponseCode: pickString(rawData.dnsResponseCode, rawData.responseCode, rawData.rcode, rawMetadata.dnsResponseCode, rawMetadata.responseCode, rawMetadata.rcode),
      dnsResolver: pickString(rawData.dnsResolver, rawData.resolver, rawData.resolverIp, rawMetadata.dnsResolver, rawMetadata.resolver, rawMetadata.resolverIp),
      dnsProtocol: pickString(rawData.dnsProtocol, rawMetadata.dnsProtocol),
      dnsEncrypted: typeof rawData.dnsEncrypted === 'boolean' ? rawData.dnsEncrypted : (typeof rawMetadata.dnsEncrypted === 'boolean' ? rawMetadata.dnsEncrypted : undefined),
    };

    const eventType = rawData.eventType || rawData.type || conn.eventType || 'network_connection';
    const severity = rawData.severity || conn.severity || 'low';
    const protocol = rawData.protocol || conn.protocol || null;
    const action = rawData.action || conn.action || 'observed';

    // Basic normalization
    const normalized: InsertNormalizedEvent = {
      rawEventId: event.id,
      sourceId: event.sourceId,
      userId: event.userId,
      eventType,
      severity,
      message: rawData.message || 'No message provided',
      metadata: enrichedMetadata,
      sourceURL: rawData.sourceURL,
      deviceName: rawData.deviceName,
      threatVector: rawData.threatVector,
      protocol,
      action,
      sourcePort: rawData.sourcePort || conn.sourcePort || null,
      destinationPort: rawData.destinationPort || conn.destinationPort || null,
      // Use timestamp only if present and valid
      ...(rawData.timestamp ? { timestamp: new Date(rawData.timestamp) } : {}),
    };

    // IP Enrichment
    const sourceIp = rawData.sourceIp || rawData.sourceIP || rawData.ipAddress || conn.ipAddress || conn.sourceIp || conn.sourceIP;
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

    const destinationIp = rawData.destinationIp || rawData.destinationIP || conn.destinationIp || conn.destinationIP;
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
      threatSignature = await detectThreats(normalized, preferences);
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