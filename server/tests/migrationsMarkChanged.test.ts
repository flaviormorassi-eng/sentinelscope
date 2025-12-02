import { describe, it } from 'vitest';
import { spawnSync } from 'node:child_process';

// Requires MIGRATION env set to an applied migration; otherwise skip.

describe('migration mark-changed remediation', () => {
  const dbUrl = process.env.DATABASE_URL;
  const target = process.env.MIGRATION;
  if (!dbUrl || !target) { it.skip('skipped (no DATABASE_URL or MIGRATION)', () => {}); return; }
  it('runs and emits success or appropriate error JSON', () => {
    const result = spawnSync('node', ['scripts/migration-mark-changed.ts'], { env: { ...process.env, JSON: '1' }, encoding: 'utf8' });
    const out = result.stdout.trim();
    if (!out.startsWith('{')) throw new Error('Expected JSON output');
    const parsed = JSON.parse(out);
    if (!parsed.error && parsed.status !== 'updated' && parsed.message !== 'Checksum unchanged; nothing to update.') {
      throw new Error('Unexpected remediation output');
    }
  });
});
