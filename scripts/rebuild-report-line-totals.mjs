/**
 * Rebuild report_line_totals / report_day_ledger for every reports_daily row
 * after migration 030 (Asia/Manila txn_date parsing).
 *
 * Usage: node scripts/rebuild-report-line-totals.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function loadEnv() {
  const text = fs.readFileSync(path.join(root, ".env"), "utf8");
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

const supabaseUrl = (
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  ""
).replace(/\/$/, "");
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
  "";

if (!supabaseUrl || !serviceKey) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

async function pgQuery(query) {
  const res = await fetch(`${supabaseUrl}/pg/query`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
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
      typeof json === "string"
        ? json
        : json?.error || json?.message || JSON.stringify(json);
    throw new Error(`HTTP ${res.status}: ${msg}`);
  }
  return json;
}

function asRows(result) {
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.rows)) return result.rows;
  if (Array.isArray(result?.data)) return result.data;
  return [];
}

const idRows = asRows(
  await pgQuery(`SELECT id::text AS id FROM public.reports_daily ORDER BY report_date, id`),
);
const ids = idRows.map((r) => r.id).filter(Boolean);
console.log(`Rebuilding rollups for ${ids.length} reports...`);

const batchSize = 5;
let done = 0;
for (let i = 0; i < ids.length; i += batchSize) {
  const batch = ids.slice(i, i + batchSize);
  const calls = batch
    .map((id) => `PERFORM public.report_line_totals_rebuild('${id}'::uuid);`)
    .join("\n");
  await pgQuery(`DO $$\nBEGIN\n${calls}\nEND $$;`);
  done += batch.length;
  console.log(`  ${done}/${ids.length}`);
}

// Verify Greenbelt Aug 2026 — Monthly (UTC dailyBreakdown slice) must match HQ Sync rollup.
const verify = asRows(
  await pgQuery(`
    WITH b AS (
      SELECT id FROM public.branches WHERE lower(name) = 'greenbelt' LIMIT 1
    ),
    r AS (
      SELECT
        rd.id,
        (rd.summary_json->>'grandTotal')::numeric AS file_total,
        rd.summary_json->'dailyBreakdown' AS bd
      FROM public.reports_daily rd
      JOIN b ON b.id = rd.branch_id
      WHERE rd.report_date = '2026-08-01'
        AND rd.date_range_end = '2026-08-31'
      LIMIT 1
    ),
    monthly AS (
      SELECT
        r.id,
        r.file_total,
        coalesce(sum((day.value->>'grandTotal')::numeric), 0) AS monthly_aug
      FROM r
      LEFT JOIN LATERAL jsonb_each(r.bd) AS day(key, value) ON true
      WHERE day.key BETWEEN '2026-08-01' AND '2026-08-31'
      GROUP BY r.id, r.file_total
    )
    SELECT
      m.file_total,
      m.monthly_aug,
      coalesce(sum(t.sales), 0) AS hq_aug,
      coalesce(sum(t.sales) FILTER (WHERE t.txn_date = '2026-08-01'), 0) AS aug1,
      coalesce(sum(t.sales) FILTER (WHERE t.txn_date = '2026-07-31'), 0) AS jul31
    FROM monthly m
    LEFT JOIN public.report_line_totals t
      ON t.report_id = m.id
     AND t.txn_date BETWEEN '2026-08-01' AND '2026-08-31'
    GROUP BY m.file_total, m.monthly_aug
  `),
);

const row = verify[0];
if (!row) {
  console.warn("Greenbelt Aug report not found for verify");
} else {
  const monthlyAug = Number(row.monthly_aug);
  const hq = Number(row.hq_aug);
  console.log({
    fileTotal: Number(row.file_total),
    monthlyAug,
    hqAugWindow: hq,
    aug1: Number(row.aug1),
    jul31: Number(row.jul31),
    gapMonthlyVsHq: monthlyAug - hq,
  });
  if (Math.abs(monthlyAug - hq) > 0.5) {
    console.error("VERIFY FAIL: Monthly Aug slice still differs from HQ Sync");
    process.exitCode = 1;
  } else {
    console.log("VERIFY OK: Monthly Aug matches HQ Sync");
  }
}
