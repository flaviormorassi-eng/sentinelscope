import { type InsertThreat } from '@shared/schema';

const THREAT_TYPES = ['malware', 'phishing', 'ddos', 'bruteforce', 'injection', 'xss', 'ransomware', 'botnet'];
const SEVERITIES = ['low', 'medium', 'high', 'critical'];
const STATUSES = ['detected', 'blocked', 'analyzing', 'resolved'];
const THREAT_VECTORS = ['email', 'web', 'network', 'usb', 'download', 'other'];
const DEVICE_NAMES = ['DESKTOP-PC01', 'LAPTOP-DEV02', 'SERVER-WEB01', 'WORKSTATION-05', 'MACBOOK-ADMIN', 'PC-FINANCE01', 'LAPTOP-HR03', 'SERVER-DB01'];

// Sample IP addresses and locations
const THREAT_SOURCES = [
  { ip: '185.220.101.', country: 'Russia', city: 'Moscow', lat: '55.7558', lon: '37.6173' },
  { ip: '103.253.145.', country: 'China', city: 'Beijing', lat: '39.9042', lon: '116.4074' },
  { ip: '45.95.168.', country: 'Iran', city: 'Tehran', lat: '35.6892', lon: '51.3890' },
  { ip: '176.123.5.', country: 'Ukraine', city: 'Kyiv', lat: '50.4501', lon: '30.5234' },
  { ip: '91.219.237.', country: 'Netherlands', city: 'Amsterdam', lat: '52.3676', lon: '4.9041' },
  { ip: '194.67.217.', country: 'Germany', city: 'Frankfurt', lat: '50.1109', lon: '8.6821' },
  { ip: '89.248.165.', country: 'Romania', city: 'Bucharest', lat: '44.4268', lon: '26.1025' },
  { ip: '103.75.201.', country: 'India', city: 'Mumbai', lat: '19.0760', lon: '72.8777' },
  { ip: '200.152.38.', country: 'Brazil', city: 'São Paulo', lat: '-23.5505', lon: '-46.6333' },
  { ip: '41.60.232.', country: 'Nigeria', city: 'Lagos', lat: '6.5244', lon: '3.3792' },
];

const DESCRIPTIONS = {
  malware: [
    'Trojan horse detected attempting system infiltration',
    'Malicious payload intercepted in download stream',
    'Backdoor installation attempt blocked',
    'Virus signature match in file upload',
  ],
  phishing: [
    'Phishing email with credential harvesting link',
    'Spoofed login page detected',
    'Social engineering attempt via fake invoice',
    'Suspicious domain mimicking legitimate service',
  ],
  ddos: [
    'DDoS attack detected - excessive request volume',
    'Botnet coordinated attack in progress',
    'SYN flood attack mitigated',
    'UDP amplification attack blocked',
  ],
  bruteforce: [
    'SSH brute force attack detected',
    'Multiple failed login attempts from single IP',
    'Dictionary attack on admin panel',
    'Credential stuffing attempt identified',
  ],
  injection: [
    'SQL injection attempt in search parameter',
    'Database query manipulation detected',
    'Command injection in API endpoint',
    'LDAP injection attempt blocked',
  ],
  xss: [
    'Cross-site scripting attempt in user input',
    'Malicious JavaScript injection detected',
    'DOM-based XSS exploit prevented',
    'Stored XSS payload sanitized',
  ],
  ransomware: [
    'Ransomware encryption pattern detected',
    'File system anomaly indicating ransomware',
    'Known ransomware signature match',
    'Suspicious file extension changes blocked',
  ],
  botnet: [
    'C&C server communication detected',
    'Botnet participation attempt',
    'Peer-to-peer botnet activity',
    'IRC-based bot command intercepted',
  ],
};

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function generateMockThreat(userId: string, targetIP: string = '192.168.1.1'): InsertThreat {
  const source = randomItem(THREAT_SOURCES);
  const type = randomItem(THREAT_TYPES);
  const severity = randomItem(SEVERITIES);
  const status = randomItem(STATUSES);
  const vector = randomItem(THREAT_VECTORS);
  
  const sourceIP = `${source.ip}${randomInt(1, 254)}`;
  const description = randomItem(DESCRIPTIONS[type as keyof typeof DESCRIPTIONS]);

  // Generate realistic URLs based on threat type
  let sourceURL = null;
  if (type === 'phishing') {
    const phishingDomains = ['secure-login-verify.net', 'account-confirm.com', 'update-credentials.org', 'verify-account-now.net'];
    sourceURL = `https://${randomItem(phishingDomains)}/login?ref=${randomInt(1000, 9999)}`;
  } else if (type === 'malware' || type === 'ransomware') {
    const malwareDomains = ['free-software-download.xyz', 'crack-tools.net', 'pirated-apps.org', 'fake-update.com'];
    sourceURL = `https://${randomItem(malwareDomains)}/download/${randomInt(100, 999)}`;
  } else if (type === 'xss' || type === 'injection') {
    sourceURL = `https://vulnerable-site.com/search?q=<script>alert(${randomInt(1, 100)})</script>`;
  }

  return {
    userId,
    severity,
    type,
    sourceIP,
    sourceCountry: source.country,
    sourceCity: source.city,
    sourceLat: source.lat,
    sourceLon: source.lon,
    targetIP,
    status,
    description,
    blocked: status === 'blocked' || (severity === 'critical' && Math.random() > 0.3),
    sourceURL,
    deviceName: randomItem(DEVICE_NAMES),
    threatVector: vector,
  };
}

export function generateMultipleThreats(userId: string, count: number, targetIP?: string): InsertThreat[] {
  return Array.from({ length: count }, () => generateMockThreat(userId, targetIP));
}
