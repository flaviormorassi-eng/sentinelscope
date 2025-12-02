import { describe, it } from 'vitest';
import { spawnSync } from 'node:child_process';

describe('migrations pending-only JSON', () => {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) { it.skip('skipped (no DATABASE_URL)', () => {}); return; }
  it('outputs only pending array', () => {
    const result = spawnSync('node', ['scripts/list-migrations.ts'], { env: { ...process.env, JSON: '1', PENDING_ONLY: '1' }, encoding: 'utf8' });
    if (result.status !== 0) throw new Error('pending-only script failed');
    const out = result.stdout.trim();
    if (!out.startsWith('{')) throw new Error('Expected JSON output');
    const parsed = JSON.parse(out);
    if (!('pending' in parsed)) throw new Error('JSON missing pending key');
    if ('applied' in parsed) throw new Error('Should not include applied key in pending-only mode');
  });
});
