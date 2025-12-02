import { describe, it, expect } from 'vitest';
import pkg from 'pg';
const { Pool } = pkg;

// Simple integration verification of baseline + incremental columns
// Ensures user_mfa & webauthn_credentials tables exist with expected new columns.

describe('MFA & WebAuthn schema verification', () => {
  const dbUrl = process.env.DATABASE_URL;
  // Skip suite gracefully if DATABASE_URL not provided (CI or local ephemeral env)
  if (!dbUrl) {
    it.skip('skipped because DATABASE_URL not set', () => {});
    return;
  }
  const pool = new Pool({ connectionString: dbUrl });

  it('user_mfa has mfa_last_reset_at column', async () => {
    const res = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name='user_mfa'`);
    const cols = res.rows.map(r => r.column_name);
    expect(cols).toContain('mfa_last_reset_at');
  });

  it('webauthn_credentials has compromised column', async () => {
    const res = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name='webauthn_credentials'`);
    const cols = res.rows.map(r => r.column_name);
    expect(cols).toContain('compromised');
  });
});
