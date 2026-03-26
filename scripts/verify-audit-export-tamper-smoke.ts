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

function printUsage() {
  console.log(`Usage: npm run audit:verify:tamper -- --file <bundle.json> [--key <signing-key>] [--json-only]\n\nBehavior:\n  1) Verifies original bundle is valid\n  2) Mutates first record action\n  3) Verifies tampered bundle is invalid\n\nExit codes:\n  0 tamper detection works\n  1 tamper not detected\n  2 original bundle already invalid or usage/config error\n`);
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

function tamperBundle(original: SignedAuditExportBundle): SignedAuditExportBundle {
  const bundle = JSON.parse(JSON.stringify(original)) as SignedAuditExportBundle;
  if (!Array.isArray(bundle.records) || bundle.records.length === 0) {
    throw new Error('Cannot tamper: bundle has no records');
  }
  const firstRecord = bundle.records[0] as any;
  firstRecord.action = `${String(firstRecord.action ?? 'unknown')}_tampered`;
  return bundle;
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
  const originalBundle = normalizeBundle(parsed);

  const originalVerification = verifySignedAuditExport({
    bundle: originalBundle,
    signingKey,
  });

  if (!originalVerification.valid) {
    console.error('Original bundle is not valid; cannot run tamper smoke reliably.');
    if (!args.jsonOnly) {
      console.log(JSON.stringify({ original: originalVerification }, null, 2));
    }
    process.exit(2);
  }

  const tamperedBundle = tamperBundle(originalBundle);
  const tamperedVerification = verifySignedAuditExport({
    bundle: tamperedBundle,
    signingKey,
  });

  const output = {
    file: absoluteFilePath,
    originalValid: originalVerification.valid,
    tamperDetected: !tamperedVerification.valid,
    tamperedChecks: tamperedVerification.checks,
    tamperedReasons: tamperedVerification.reasons,
  };

  if (!args.jsonOnly) {
    console.log('[audit:verify:tamper] smoke check complete');
  }
  console.log(JSON.stringify(output, null, 2));

  if (tamperedVerification.valid) {
    process.exit(1);
  }

  process.exit(0);
}

main().catch((error: any) => {
  console.error('[audit:verify:tamper] failed:', error?.message || String(error));
  process.exit(10);
});
