import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
for (const line of fs.readFileSync(path.join(root, '.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (!m) continue;
  let val = m[2].trim().replace(/^["']|["']$/g, '');
  if (!(m[1].trim() in process.env)) process.env[m[1].trim()] = val;
}

const base = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const k = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const res = await fetch(`${base}/pg/query`, {
  method: 'POST',
  headers: {
    apikey: k,
    Authorization: `Bearer ${k}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    query: `
      SELECT pg_get_functiondef(p.oid) AS def
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'reports_daily_compute_slim'
    `,
  }),
});
const json = await res.json();
const def = Array.isArray(json) ? json[0]?.def : json?.rows?.[0]?.def;
if (!def) {
  console.log('NO DEF', json);
  process.exit(1);
}
console.log('has_contained_fastpath', def.includes('Fully contained') || def.includes('date_range_start >= p_date_from'));
console.log('has_key_projection', def.includes("'mappedCat'"));
console.log('has_jsonb_agg_elem', def.includes('jsonb_agg(elem)'));
