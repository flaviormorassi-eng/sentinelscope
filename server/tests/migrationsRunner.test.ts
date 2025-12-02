import { describe, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'fs';
import path from 'path';

// Basic smoke test for migrations runner: ensures it can execute without throwing when DATABASE_URL is present.
// Skips gracefully if DATABASE_URL is missing.

describe('migrations runner', () => {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    it.skip('skipped because DATABASE_URL not set', () => {});
    return;
  }

  it('applies or skips migrations cleanly', () => {
    const scriptPath = path.resolve(process.cwd(), 'scripts/apply-migrations.ts');
    if (!fs.existsSync(scriptPath)) throw new Error('apply-migrations.ts missing');
    const result = spawnSync('node', [scriptPath], { env: process.env, encoding: 'utf8' });
    if (result.status !== 0) {
      throw new Error(`Migrations runner exited with code ${result.status}:\nSTDERR:${result.stderr}\nSTDOUT:${result.stdout}`);
    }
  });
});
