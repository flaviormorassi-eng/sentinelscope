#!/usr/bin/env tsx
/**
 * Create a new numbered migration + down file.
 * Usage: npm run db:migrate:new -- "add user_sessions table"
 * Or: DESCRIPTION="add user_sessions table" npm run db:migrate:new
 */
import fs from 'fs';
import path from 'path';

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function main() {
  const args = process.argv.slice(2);
  const descEnv = process.env.DESCRIPTION;
  const raw = (descEnv && descEnv.trim()) || args.join(' ').trim();
  if (!raw) {
    console.error('Description required (pass as args or DESCRIPTION env var).');
    process.exit(1);
  }
  const migrationsDir = path.resolve(process.cwd(), 'migrations');
  if (!fs.existsSync(migrationsDir)) fs.mkdirSync(migrationsDir, { recursive: true });
  const existing = fs.readdirSync(migrationsDir).filter(f => /^\d+.*\.sql$/.test(f)).sort();
  const maxNum = existing.reduce((m, f) => {
    const n = parseInt(f.split('_')[0], 10); return isNaN(n) ? m : Math.max(m, n);
  }, 0);
  const nextNum = String(maxNum + 1).padStart(4, '0');
  const slug = slugify(raw) || 'migration';
  const baseName = `${nextNum}_${slug}.sql`;
  const filePath = path.join(migrationsDir, baseName);
  const downPath = path.join(migrationsDir, `${nextNum}_${slug}.down.sql`);
  if (fs.existsSync(filePath)) {
    console.error('Target file already exists:', filePath);
    process.exit(1);
  }
  const template = `-- Migration ${nextNum}: ${raw}\n-- Write forward changes below.\nBEGIN;\n-- TODO: forward SQL here\nCOMMIT;\n`;
  const downTemplate = `-- Rollback for migration ${nextNum}: ${raw}\n-- Write rollback changes below (reverse of forward). Data loss risk.\nBEGIN;\n-- TODO: rollback SQL here\nCOMMIT;\n`;
  fs.writeFileSync(filePath, template, 'utf8');
  fs.writeFileSync(downPath, downTemplate, 'utf8');
  console.log(`Created migration files:\n  ${filePath}\n  ${downPath}`);
}

main();
