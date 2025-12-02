import { describe, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'fs';
import path from 'path';

describe('migrations list script', () => {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    it.skip('skipped because DATABASE_URL not set', () => {});
    return;
  }
  it('prints applied and pending migrations', () => {
    const scriptPath = path.resolve(process.cwd(), 'scripts/list-migrations.ts');
    if (!fs.existsSync(scriptPath)) throw new Error('list-migrations.ts missing');
    const result = spawnSync('node', [scriptPath], { env: process.env, encoding: 'utf8' });
    if (result.status !== 0) {
      throw new Error(`list-migrations exited with code ${result.status}:\nSTDERR:${result.stderr}\nSTDOUT:${result.stdout}`);
    }
    // Basic sanity: output should contain headers
    if (!/Applied migrations:/i.test(result.stdout)) {
      throw new Error('Output missing "Applied migrations:" header');
    }
  });
});
