#!/usr/bin/env tsx
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import {
  verifySignedAuditExport,
  type SignedAuditExportBundle,
} from '../server/utils/auditExport';

type CliArgs = {
  filePath?: string;
  signingKey?: string;
  jsonOnly: boolean;
  help: boolean;
};

function printUsage() {
  console.log(`Usage: npm run audit:verify -- --file <bundle.json> [--key <signing-key>] [--json-only]\n\nOptions:\n  --file <path>     Path to export bundle JSON file (required)\n  --key <key>       Signing key override (otherwise uses AUDIT_EXPORT_SIGNING_KEY, then JWT_SECRET in non-production)\n  --json-only       Print only verification JSON output\n  --help            Show this help\n`);
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    jsonOnly: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--file') {
      args.filePath = argv[index + 1];
      index += 1;
    } else if (token === '--key') {
      args.signingKey = argv[index + 1];
      index += 1;
    } else if (token === '--json-only') {
      args.jsonOnly = true;
    } else if (token === '--help' || token === '-h') {
      args.help = true;
    }
  }

  return args;
}

function resolveSigningKey(cliKey?: string): string | undefined {
  if (cliKey) return cliKey;
  if (process.env.AUDIT_EXPORT_SIGNING_KEY) return process.env.AUDIT_EXPORT_SIGNING_KEY;
  if (process.env.NODE_ENV !== 'production' && process.env.JWT_SECRET) return process.env.JWT_SECRET;
  return undefined;
}

function normalizeBundle(input: unknown): SignedAuditExportBundle {
  if (!input || typeof input !== 'object') {
    throw new Error('Invalid JSON content: expected object');
  }

  const candidate = (input as any).data && typeof (input as any).data === 'object'
    ? (input as any).data
    : input;

  if (!candidate?.integrity || !Array.isArray(candidate?.records)) {
    throw new Error('Invalid export bundle: missing integrity or records fields');
  }

  return candidate as SignedAuditExportBundle;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printUsage();
    process.exit(0);
  }

  if (!args.filePath) {
    console.error('Missing required argument: --file <bundle.json>');
    printUsage();
    process.exit(2);
  }

  const signingKey = resolveSigningKey(args.signingKey);
  if (!signingKey) {
    console.error('No signing key available. Set AUDIT_EXPORT_SIGNING_KEY or pass --key.');
    process.exit(2);
  }

  const absoluteFilePath = path.resolve(process.cwd(), args.filePath);
  const raw = fs.readFileSync(absoluteFilePath, 'utf8');
  const parsed = JSON.parse(raw);
  const bundle = normalizeBundle(parsed);

  const verification = verifySignedAuditExport({ bundle, signingKey });
  const output = {
    file: absoluteFilePath,
    keyId: bundle.integrity?.keyId,
    valid: verification.valid,
    checks: verification.checks,
    reasons: verification.reasons,
    computed: verification.computed,
    integrity: {
      payloadHash: bundle.integrity?.payloadHash,
      chainHash: bundle.integrity?.chainHash,
      signature: bundle.integrity?.signature,
      recordCount: bundle.integrity?.recordCount,
      canonicalization: bundle.integrity?.canonicalization,
      digestAlgorithm: bundle.integrity?.digestAlgorithm,
      signatureAlgorithm: bundle.integrity?.signatureAlgorithm,
    },
  };

  if (!args.jsonOnly) {
    console.log('[audit:verify] verification complete');
  }
  console.log(JSON.stringify(output, null, 2));

  process.exit(verification.valid ? 0 : 1);
}

main().catch((error: any) => {
  console.error('[audit:verify] failed:', error?.message || String(error));
  process.exit(10);
});
