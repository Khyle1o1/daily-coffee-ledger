/**
 * Apply a SQL migration via Kong /pg/query (Coolify self-hosted Supabase).
 * Postgres is not publicly exposed — use this instead of DATABASE_URL.
 *
 * Usage: node scripts/apply-migration-pg-query.mjs supabase/migrations/025_....sql
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { splitSql } from './migrate-new-db.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function loadEnv() {
  const text = fs.readFileSync(path.join(root, '.env'), 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (!m) continue;
    const key = m[1].trim();
    let val = m[2].trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

loadEnv();

const migration = process.argv[2];
if (!migration) {
  console.error('Usage: node scripts/apply-migration-pg-query.mjs <path-to.sql>');
  process.exit(1);
}

const supabaseUrl = (
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  ''
).replace(/\/$/, '');
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
  '';

if (!supabaseUrl || !serviceKey) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const sqlPath = path.isAbsolute(migration)
  ? migration
  : path.join(root, migration);
const sql = fs.readFileSync(sqlPath, 'utf8').replace(/^\uFEFF/, '');

async function pgQuery(query) {
  const res = await fetch(`${supabaseUrl}/pg/query`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  if (!res.ok) {
    const msg =
      typeof json === 'string'
        ? json
        : json?.error || json?.message || JSON.stringify(json);
    throw new Error(`HTTP ${res.status}: ${msg}`);
  }
  return json;
}

const statements = splitSql(sql).filter((s) => s.trim().length > 0);
console.log(
  `Applying ${path.basename(sqlPath)} via ${supabaseUrl}/pg/query (${statements.length} statements)`,
);

for (let i = 0; i < statements.length; i++) {
  const stmt = statements[i];
  const preview = stmt.replace(/\s+/g, ' ').slice(0, 100);
  try {
    await pgQuery(stmt);
    console.log(`  [${i + 1}/${statements.length}] OK  ${preview}`);
  } catch (err) {
    console.error(`  [${i + 1}/${statements.length}] FAIL ${preview}`);
    console.error(err.message);
    process.exitCode = 1;
    break;
  }
}

if (!process.exitCode) {
  console.log('Applied:', path.basename(sqlPath));
}
