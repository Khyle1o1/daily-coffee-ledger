import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

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
  console.error('Usage: node scripts/apply-migration.mjs <path-to.sql>');
  process.exit(1);
}

const sqlPath = path.isAbsolute(migration)
  ? migration
  : path.join(root, migration);
const sql = fs.readFileSync(sqlPath, 'utf8').replace(/^\uFEFF/, '');

function encodeDatabaseUrl(raw) {
  if (!raw) return raw;
  // Encode password special chars (#, @, etc.) that break URL parsing.
  const m = raw.match(/^(postgresql:\/\/[^:/]+:)([^@]+)(@.+)$/i);
  if (!m) return raw;
  return `${m[1]}${encodeURIComponent(decodeURIComponent(m[2]))}${m[3]}`;
}

const dbUrl = encodeDatabaseUrl(process.env.DATABASE_URL);
const isLocal =
  /@127\.0\.0\.1:|@localhost:|@\[::1\]:/i.test(dbUrl || '') ||
  /sslmode=disable/i.test(dbUrl || '');
const client = new pg.Client({
  connectionString: dbUrl,
  ssl: isLocal ? false : { rejectUnauthorized: false },
});

await client.connect();
console.log('Connected');
try {
  await client.query(sql);
  console.log('Applied:', path.basename(sqlPath));
} catch (err) {
  console.error('ERROR:', err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
