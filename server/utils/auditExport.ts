import crypto from 'crypto';

type JsonValue = string | number | boolean | null | JsonObject | JsonValue[];
type JsonObject = { [key: string]: JsonValue };

function normalizeForCanonicalJson(value: any): JsonValue {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalizeForCanonicalJson);
  if (typeof value === 'object') {
    const out: JsonObject = {};
    const keys = Object.keys(value).sort((a, b) => a.localeCompare(b));
    for (const key of keys) {
      const normalized = normalizeForCanonicalJson(value[key]);
      if (normalized !== undefined) {
        out[key] = normalized;
      }
    }
    return out;
  }
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'function') return null;
  return value as JsonValue;
}

function canonicalJsonString(value: any): string {
  return JSON.stringify(normalizeForCanonicalJson(value));
}

function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

function hmacSha256Hex(secret: string, input: string): string {
  return crypto.createHmac('sha256', secret).update(input, 'utf8').digest('hex');
}

export type SignedAuditExportBundle = {
  exportVersion: string;
  generatedAt: string;
  exportedBy: string;
  filters: Record<string, any>;
  retention: {
    mode: string;
    immutable: boolean;
    retentionDays: number;
    lockUntil: string;
  };
  records: any[];
  integrity: {
    canonicalization: string;
    digestAlgorithm: string;
    signatureAlgorithm: string;
    keyId: string;
    payloadHash: string;
    chainHash: string;
    signature: string;
    recordCount: number;
  };
};

export type AuditExportVerificationResult = {
  valid: boolean;
  checks: {
    payloadHashMatches: boolean;
    chainHashMatches: boolean;
    signatureMatches: boolean;
    recordCountMatches: boolean;
    canonicalizationSupported: boolean;
    digestAlgorithmSupported: boolean;
    signatureAlgorithmSupported: boolean;
  };
  computed: {
    payloadHash: string;
    chainHash: string;
    signature: string;
  };
  reasons: string[];
};

export function buildSignedAuditExport(params: {
  logs: any[];
  filters: Record<string, any>;
  exportedBy: string;
  keyId: string;
  retentionDays: number;
  signingKey: string;
}) {
  const { logs, filters, exportedBy, keyId, retentionDays, signingKey } = params;
  const generatedAt = new Date();
  const lockUntil = new Date(generatedAt.getTime() + retentionDays * 24 * 60 * 60 * 1000);

  let previousHash = 'GENESIS';
  const recordHashes: string[] = [];

  for (const log of logs) {
    const canonicalRecord = canonicalJsonString(log);
    const recordHash = sha256Hex(`${previousHash}|${canonicalRecord}`);
    recordHashes.push(recordHash);
    previousHash = recordHash;
  }

  const payload = {
    exportVersion: '1.0',
    generatedAt: generatedAt.toISOString(),
    exportedBy,
    filters,
    retention: {
      mode: 'governance_lock',
      immutable: true,
      retentionDays,
      lockUntil: lockUntil.toISOString(),
    },
    records: logs,
  };

  const canonicalPayload = canonicalJsonString(payload);
  const payloadHash = sha256Hex(canonicalPayload);
  const chainHash = recordHashes.length > 0 ? recordHashes[recordHashes.length - 1] : sha256Hex('GENESIS');
  const signature = hmacSha256Hex(signingKey, payloadHash);

  return {
    ...payload,
    integrity: {
      canonicalization: 'json_keys_lexicographic_v1',
      digestAlgorithm: 'sha256',
      signatureAlgorithm: 'hmac-sha256',
      keyId,
      payloadHash,
      chainHash,
      signature,
      recordCount: logs.length,
    },
  };
}

export function verifySignedAuditExport(params: {
  bundle: SignedAuditExportBundle;
  signingKey: string;
}): AuditExportVerificationResult {
  const { bundle, signingKey } = params;
  const reasons: string[] = [];

  const checks = {
    payloadHashMatches: false,
    chainHashMatches: false,
    signatureMatches: false,
    recordCountMatches: false,
    canonicalizationSupported: bundle?.integrity?.canonicalization === 'json_keys_lexicographic_v1',
    digestAlgorithmSupported: bundle?.integrity?.digestAlgorithm === 'sha256',
    signatureAlgorithmSupported: bundle?.integrity?.signatureAlgorithm === 'hmac-sha256',
  };

  if (!checks.canonicalizationSupported) {
    reasons.push('Unsupported canonicalization');
  }
  if (!checks.digestAlgorithmSupported) {
    reasons.push('Unsupported digest algorithm');
  }
  if (!checks.signatureAlgorithmSupported) {
    reasons.push('Unsupported signature algorithm');
  }

  const payloadWithoutIntegrity = {
    exportVersion: bundle?.exportVersion,
    generatedAt: bundle?.generatedAt,
    exportedBy: bundle?.exportedBy,
    filters: bundle?.filters,
    retention: bundle?.retention,
    records: bundle?.records,
  };

  const computedPayloadHash = sha256Hex(canonicalJsonString(payloadWithoutIntegrity));

  let previousHash = 'GENESIS';
  const records = Array.isArray(bundle?.records) ? bundle.records : [];
  for (const log of records) {
    const canonicalRecord = canonicalJsonString(log);
    previousHash = sha256Hex(`${previousHash}|${canonicalRecord}`);
  }
  const computedChainHash = records.length > 0 ? previousHash : sha256Hex('GENESIS');
  const computedSignature = hmacSha256Hex(signingKey, computedPayloadHash);

  checks.payloadHashMatches = computedPayloadHash === bundle?.integrity?.payloadHash;
  checks.chainHashMatches = computedChainHash === bundle?.integrity?.chainHash;
  checks.signatureMatches = computedSignature === bundle?.integrity?.signature;
  checks.recordCountMatches = records.length === bundle?.integrity?.recordCount;

  if (!checks.payloadHashMatches) reasons.push('Payload hash mismatch');
  if (!checks.chainHashMatches) reasons.push('Chain hash mismatch');
  if (!checks.signatureMatches) reasons.push('Signature mismatch');
  if (!checks.recordCountMatches) reasons.push('Record count mismatch');

  const valid = Object.values(checks).every(Boolean);

  return {
    valid,
    checks,
    computed: {
      payloadHash: computedPayloadHash,
      chainHash: computedChainHash,
      signature: computedSignature,
    },
    reasons,
  };
}
