import type { NormalizedEvent } from '@shared/schema';

interface ThreatSignature {
  name: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number; // 0-100
  match: (event: NormalizedEvent) => boolean;
}

// A simple, extendable threat intelligence rule set.
// In a real-world scenario, this would be much more complex,
// potentially loaded from a database or external feeds.
const signatures: ThreatSignature[] = [
  {
    name: 'Suspicious User-Agent (sqlmap)',
    type: 'injection',
    severity: 'high',
    confidence: 90,
    match: (event) =>
      !!(event.metadata as any)?.userAgent?.toLowerCase().includes('sqlmap'),
  },
  {
    name: 'Potential XSS in URL',
    type: 'xss',
    severity: 'medium',
    confidence: 70,
    match: (event) =>
      !!event.sourceURL?.toLowerCase().includes('<script'),
  },
  {
    name: 'Known Malware Domain',
    type: 'malware',
    severity: 'critical',
    confidence: 100,
    match: (event) =>
      !!event.sourceURL?.includes('malicious-domain-example.com'),
  },
];

export function analyzeEvent(event: NormalizedEvent): ThreatSignature | null {
  for (const signature of signatures) {
    if (signature.match(event)) {
      return signature;
    }
  }
  return null;
}