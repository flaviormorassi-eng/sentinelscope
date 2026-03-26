#!/usr/bin/env tsx
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { buildSignedAuditExport } from '../server/utils/auditExport';

const SMOKE_KEY = 'audit-verify-smoke-key';

function runNpm(args: string[]) {
  return spawnSync('npm', args, {
    stdio: 'inherit',
    env: { ...process.env },
  });
}

function main() {
  const tempFile = path.join(os.tmpdir(), `sentinel-audit-export-smoke-${process.pid}.json`);

  const bundle = buildSignedAuditExport({
    logs: [
      {
        id: 'smoke-1',
        userId: 'smoke-user',
        eventType: 'AUTH',
        eventCategory: 'AUTHENTICATION',
        action: 'login_success',
        status: 'success',
        severity: 'info',
        timestamp: '2026-03-26T00:00:00.000Z',
      },
    ],
    filters: { limit: 1, smoke: true },
    exportedBy: 'smoke-runner',
    keyId: 'smoke-key-id',
    retentionDays: 365,
    signingKey: SMOKE_KEY,
  });

  fs.writeFileSync(tempFile, JSON.stringify(bundle, null, 2));
  console.log(`[audit:verify:smoke] sample bundle written: ${tempFile}`);

  const verifyResult = runNpm([
    'run',
    'audit:verify',
    '--',
    '--file',
    tempFile,
    '--key',
    SMOKE_KEY,
    '--json-only',
  ]);

  if ((verifyResult.status ?? 1) !== 0) {
    console.error('[audit:verify:smoke] audit:verify failed');
    process.exit(verifyResult.status ?? 1);
  }

  const tamperResult = runNpm([
    'run',
    'audit:verify:tamper',
    '--',
    '--file',
    tempFile,
    '--key',
    SMOKE_KEY,
    '--json-only',
  ]);

  if ((tamperResult.status ?? 1) !== 0) {
    console.error('[audit:verify:smoke] audit:verify:tamper failed');
    process.exit(tamperResult.status ?? 1);
  }

  console.log('[audit:verify:smoke] completed successfully');
}

main();
