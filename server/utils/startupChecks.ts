import pkg from 'pg';
const { Pool } = pkg;

interface SchemaIssue {
  table: string;
  column: string;
  message: string;
}

// Required columns introduced by incremental migrations.
// Add to this list when new critical columns must exist before serving requests.
const REQUIRED_COLUMNS: Array<{ table: string; column: string }> = [
  { table: 'user_mfa', column: 'mfa_last_reset_at' },
  { table: 'webauthn_credentials', column: 'compromised' },
];

export async function runStartupChecks(): Promise<void> {
  if (process.env.SKIP_SCHEMA_CHECKS === 'true') {
    console.warn('[startup-checks] SKIP_SCHEMA_CHECKS=true – bypassing schema validation (NOT RECOMMENDED).');
    return;
  }

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.warn('[startup-checks] DATABASE_URL not set – skipping schema validation.');
    return; // Non-fatal in dev / ephemeral envs
  }

  const pool = new Pool({ connectionString: dbUrl });
  const issues: SchemaIssue[] = [];

  try {
    for (const req of REQUIRED_COLUMNS) {
      try {
        const res = await pool.query(
          `SELECT column_name FROM information_schema.columns WHERE table_name = $1`,
          [req.table]
        );
        const cols = res.rows.map(r => r.column_name);
        if (!cols.includes(req.column)) {
          issues.push({
            table: req.table,
            column: req.column,
            message: `Missing required column '${req.column}' in table '${req.table}'. Run migrations.`
          });
        }
      } catch (e: any) {
        issues.push({
          table: req.table,
          column: req.column,
          message: `Error querying table '${req.table}': ${e?.message || String(e)}`
        });
      }
    }
  } finally {
    await pool.end();
  }

  await pool.end().catch(() => {});

  if (issues.length > 0) {
    console.error('[startup-checks] Schema validation FAILED. Details:');
    for (const i of issues) {
      console.error(` - ${i.table}.${i.column}: ${i.message}`);
    }
    console.error('[startup-checks] Abort startup. To bypass temporarily set SKIP_SCHEMA_CHECKS=true (not recommended).');
    throw new Error('Startup schema checks failed.');
  } else {
    console.log('[startup-checks] All required columns present.');
  }
}
