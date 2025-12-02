import { describe, it } from 'vitest';
import { spawnSync } from 'node:child_process';

// Cautious rollback test: only runs if DATABASE_URL and MIGRATION env provided; otherwise skip.
// To activate manually set MIGRATION to a reversible migration (e.g., 0003_add_flagged_only_default.sql) and reapply afterward.

describe('migrations rollback script', () => {
  const dbUrl = process.env.DATABASE_URL;
  const target = process.env.MIGRATION;
  if (!dbUrl || !target) {
    it.skip('skipped because DATABASE_URL or MIGRATION not set', () => {});
    return;
  }
  it('rollback emits JSON when JSON=1', () => {
    const result = spawnSync('node', ['scripts/rollback-migration.ts'], { env: { ...process.env, JSON: '1' }, encoding: 'utf8' });
    const out = result.stdout.trim();
    if (!out.startsWith('{')) throw new Error('Expected JSON output from rollback');
  });
});
