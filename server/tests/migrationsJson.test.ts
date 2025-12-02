import { describe, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import path from 'path';
import fs from 'fs';

describe('migrations JSON output', () => {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    it.skip('skipped because DATABASE_URL not set', () => {});
    return;
  }
  it('apply script emits JSON', () => {
    const scriptPath = path.resolve(process.cwd(), 'scripts/apply-migrations.ts');
    if (!fs.existsSync(scriptPath)) throw new Error('apply-migrations.ts missing');
    const result = spawnSync('node', [scriptPath], { env: { ...process.env, JSON: '1' }, encoding: 'utf8' });
    if (result.status !== 0) throw new Error('apply-migrations JSON run failed');
    const lastLine = result.stdout.trim().split('\n').pop() || '';
    if (!lastLine.startsWith('{')) throw new Error('Expected JSON output at end of apply script');
  });
  it('list script emits JSON', () => {
    const scriptPath = path.resolve(process.cwd(), 'scripts/list-migrations.ts');
    if (!fs.existsSync(scriptPath)) throw new Error('list-migrations.ts missing');
    const result = spawnSync('node', [scriptPath], { env: { ...process.env, JSON: '1' }, encoding: 'utf8' });
    if (result.status !== 0) throw new Error('list-migrations JSON run failed');
    const out = result.stdout.trim();
    if (!out.startsWith('{')) throw new Error('Expected JSON output for list script');
  });
});
