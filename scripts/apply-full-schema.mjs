import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function loadEnv() {
  const envPath = path.join(root, '.env');
  const text = fs.readFileSync(envPath, 'utf8');
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

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('Missing DATABASE_URL in .env');
  process.exit(1);
}

const sqlPath = path.join(root, 'supabase', 'migrations', 'FULL_SCHEMA.sql');
// Strip UTF-8 BOM if present (causes "syntax error near")
const sql = fs.readFileSync(sqlPath, 'utf8').replace(/^\uFEFF/, '');

const client = new pg.Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
console.log('Connected to database');

try {
  await client.query(sql);
  console.log('FULL_SCHEMA applied successfully');
} catch (err) {
  console.error('SCHEMA_ERROR:', err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
