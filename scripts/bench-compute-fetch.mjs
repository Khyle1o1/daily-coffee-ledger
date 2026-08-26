/**
 * Smoke-test reports_daily_compute_slim vs raw fetch size.
 * Usage: node scripts/bench-compute-fetch.mjs [YYYY-MM-DD] [YYYY-MM-DD]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

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

const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(
  /\/$/,
  '',
);
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
  '';

const dateFrom = process.argv[2] || '2026-08-01';
const dateTo = process.argv[3] || '2026-08-25';

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function kb(obj) {
  return Math.round(JSON.stringify(obj).length / 1024);
}

console.log(`Bench ${dateFrom} → ${dateTo} against ${url}`);

const t0 = Date.now();
const { data: raw, error: rawErr } = await supabase
  .from('reports_daily')
  .select(
    'id, branch_id, report_date, date_range_start, date_range_end, summary_json',
  )
  .lte('date_range_start', dateTo)
  .gte('date_range_end', dateFrom);
if (rawErr) throw new Error(rawErr.message);
const rawMs = Date.now() - t0;
console.log(
  `RAW table select: ${raw?.length ?? 0} rows in ${rawMs}ms (~${kb(raw)} KB)`,
);

const t1 = Date.now();
const { data: slim, error: slimErr } = await supabase.rpc(
  'reports_daily_compute_slim',
  {
    p_date_from: dateFrom,
    p_date_to: dateTo,
    p_branch_ids: null,
    p_include_row_details: true,
  },
);
if (slimErr) throw new Error(slimErr.message);
const slimMs = Date.now() - t1;
console.log(
  `SLIM RPC: ${slim?.length ?? 0} rows in ${slimMs}ms (~${kb(slim)} KB)`,
);

const t2 = Date.now();
const { data: agg, error: aggErr } = await supabase.rpc(
  'reports_daily_compute_slim',
  {
    p_date_from: dateFrom,
    p_date_to: dateTo,
    p_branch_ids: null,
    p_include_row_details: false,
  },
);
if (aggErr) throw new Error(aggErr.message);
const aggMs = Date.now() - t2;
console.log(
  `AGG-ONLY RPC: ${agg?.length ?? 0} rows in ${aggMs}ms (~${kb(agg)} KB)`,
);

if (raw && slim && kb(raw) > 0) {
  const ratio = ((1 - kb(slim) / kb(raw)) * 100).toFixed(1);
  console.log(`Wire reduction (slim vs raw): ${ratio}%`);
}
