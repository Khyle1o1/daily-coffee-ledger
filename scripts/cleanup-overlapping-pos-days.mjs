/**
 * Normalize reports_daily.date_range_* / report_date to match actual
 * Asia/Manila calendar days present in summary_json.rowDetails.
 *
 * Also strips any branch×day still covered by 2+ reports (keep newest).
 *
 * Usage: node scripts/cleanup-overlapping-pos-days.mjs [--dry-run]
 */
import pg from "pg";
import fs from "fs";

const DRY = process.argv.includes("--dry-run");

function loadDatabaseUrl() {
  const raw = fs.readFileSync(".env", "utf8");
  const line = raw.split(/\r?\n/).find((l) => l.startsWith("DATABASE_URL="));
  if (!line) throw new Error("DATABASE_URL missing");
  let url = line.slice("DATABASE_URL=".length).replace(/^"|"$/g, "");
  url = url.replace(/:([^:@/]*?)#([^@]*)@/, (_, a, b) => `:${a}%23${b}@`);
  return url;
}

function rangeSpanDays(start, end) {
  const [ys, ms, ds] = String(start).slice(0, 10).split("-").map(Number);
  const [ye, me, de] = String(end).slice(0, 10).split("-").map(Number);
  return Math.max(
    1,
    Math.round((Date.UTC(ye, me - 1, de) - Date.UTC(ys, ms - 1, ds)) / 86400000) + 1,
  );
}

function compareReports(a, b) {
  const rec = a.updatedAt - b.updatedAt;
  if (rec !== 0) return rec;
  const span = rangeSpanDays(b.start, b.end) - rangeSpanDays(a.start, a.end);
  if (span !== 0) return span;
  return a.id.localeCompare(b.id);
}

function toLocalYmd(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function rebuildSummaryJson(summaryJson, keptRows) {
  // Keep whatever category keys already exist on the report; fall back to summing mappedCat.
  const prevTotals = summaryJson?.summaryTotalsByCat ?? {};
  const categories = Object.keys(prevTotals).length
    ? Object.keys(prevTotals)
    : [...new Set(keptRows.map((r) => r.mappedCat).filter(Boolean))];

  const totals = Object.fromEntries(categories.map((c) => [c, 0]));
  const quantities = Object.fromEntries(categories.map((c) => [c, 0]));
  let mapped = 0;
  let unmapped = 0;
  let skipped = 0;
  const unmappedMap = new Map();

  for (const row of keptRows) {
    if (row.status === "SKIPPED") {
      skipped += 1;
      continue;
    }
    if (row.status === "UNMAPPED") {
      unmapped += 1;
      const key = row.rawItemName || "(blank)";
      const cur = unmappedMap.get(key) || { count: 0, totalSales: 0 };
      cur.count += 1;
      cur.totalSales += Number(row.rowSales) || 0;
      unmappedMap.set(key, cur);
      continue;
    }
    mapped += 1;
    const cat = row.mappedCat;
    if (cat) {
      if (totals[cat] == null) totals[cat] = 0;
      if (quantities[cat] == null) quantities[cat] = 0;
      totals[cat] += Number(row.rowSales) || 0;
      quantities[cat] += Number(row.quantity) || 0;
    }
  }

  const grandTotal = Object.values(totals).reduce((a, b) => a + b, 0);
  const grandQuantity = Object.values(quantities).reduce((a, b) => a + b, 0);
  const percentByCat = Object.fromEntries(
    Object.keys(totals).map((c) => [
      c,
      grandTotal > 0 ? Math.round((totals[c] / grandTotal) * 100) : 0,
    ]),
  );
  const unmappedSummary = [...unmappedMap.entries()]
    .map(([rawItemName, v]) => ({ rawItemName, ...v }))
    .sort((a, b) => b.totalSales - a.totalSales);

  return {
    ...summaryJson,
    rowDetails: keptRows,
    totalRows: keptRows.length,
    mappedRows: mapped,
    unmappedRows: unmapped,
    skippedRows: skipped,
    summaryTotalsByCat: totals,
    summaryQuantitiesByCat: quantities,
    grandTotal,
    grandQuantity,
    percentByCat,
    unmappedSummary,
  };
}

const client = new pg.Client({
  connectionString: loadDatabaseUrl(),
  ssl: { rejectUnauthorized: false },
});
client.on("error", (err) => console.error("pg client error", err.message));
await client.connect();
await client.query(`SET statement_timeout = '300s'`);

console.log(DRY ? "DRY RUN — no writes" : "LIVE — will update/delete");

// ── 1) Normalize date ranges to content bounds ─────────────────────────────
const mismatch = await client.query(`
  WITH bounds AS (
    SELECT
      rd.id,
      rd.date_range_start::date AS meta_start,
      rd.date_range_end::date AS meta_end,
      (
        SELECT MIN(((e->>'transactionDate')::timestamptz AT TIME ZONE 'Asia/Manila')::date)
        FROM jsonb_array_elements(COALESCE(rd.summary_json->'rowDetails','[]'::jsonb)) e
        WHERE NULLIF(e->>'transactionDate','') IS NOT NULL
      ) AS content_start,
      (
        SELECT MAX(((e->>'transactionDate')::timestamptz AT TIME ZONE 'Asia/Manila')::date)
        FROM jsonb_array_elements(COALESCE(rd.summary_json->'rowDetails','[]'::jsonb)) e
        WHERE NULLIF(e->>'transactionDate','') IS NOT NULL
      ) AS content_end,
      b.label
    FROM reports_daily rd
    JOIN branches b ON b.id = rd.branch_id
  )
  SELECT *
  FROM bounds
  WHERE content_start IS NOT NULL
    AND (meta_start IS DISTINCT FROM content_start OR meta_end IS DISTINCT FROM content_end)
  ORDER BY label, meta_start
`);

console.log(`range_mismatches=${mismatch.rows.length}`);
for (const r of mismatch.rows) {
  console.log(
    `  NORM ${r.label} ${r.meta_start}..${r.meta_end} → ${r.content_start}..${r.content_end}`,
  );
  if (!DRY) {
    await client.query(
      `
      update reports_daily
      set date_range_start = $2::date,
          date_range_end = $3::date,
          report_date = $2::date,
          updated_at = now()
      where id = $1
    `,
      [r.id, r.content_start, r.content_end],
    );
  }
}

// ── 2) Strip any remaining shared local days (keep newest) ─────────────────
const dupReportRows = await client.query(`
  WITH days AS (
    SELECT
      rd.id AS report_id,
      rd.branch_id,
      b.label,
      rd.updated_at,
      rd.date_range_start::date AS start_d,
      rd.date_range_end::date AS end_d,
      ((e->>'transactionDate')::timestamptz AT TIME ZONE 'Asia/Manila')::date AS local_day
    FROM reports_daily rd
    JOIN branches b ON b.id = rd.branch_id
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(rd.summary_json->'rowDetails', '[]'::jsonb)) e
    WHERE NULLIF(e->>'transactionDate','') IS NOT NULL
  ),
  dup_days AS (
    SELECT branch_id, local_day
    FROM days
    GROUP BY branch_id, local_day
    HAVING COUNT(DISTINCT report_id) > 1
  )
  SELECT d.branch_id, b.label, d.local_day::text AS local_day,
         json_agg(json_build_object(
           'id', d.report_id,
           'updatedAt', d.updated_at,
           'start', d.start_d,
           'end', d.end_d
         ) ORDER BY d.updated_at DESC) AS reports
  FROM days d
  JOIN dup_days dd ON dd.branch_id = d.branch_id AND dd.local_day = d.local_day
  JOIN branches b ON b.id = d.branch_id
  GROUP BY d.branch_id, b.label, d.local_day
  ORDER BY b.label, d.local_day
`);

console.log(`duplicate_day_slots=${dupReportRows.rows.length}`);

const stripMap = new Map();
for (const row of dupReportRows.rows) {
  const candidates = row.reports.map((r) => ({
    id: r.id,
    updatedAt: new Date(r.updatedAt).getTime(),
    start: String(r.start).slice(0, 10),
    end: String(r.end).slice(0, 10),
  }));
  candidates.sort((a, b) => compareReports(b, a));
  for (const c of candidates.slice(1)) {
    if (!stripMap.has(c.id)) stripMap.set(c.id, new Set());
    stripMap.get(c.id).add(String(row.local_day).slice(0, 10));
  }
}

let totalDeleted = 0;
let totalTrimmed = 0;
let totalRowsRemoved = 0;

for (const [reportId, days] of stripMap) {
  const { rows } = await client.query(
    `select id, date_range_start::text, date_range_end::text, summary_json
     from reports_daily where id = $1`,
    [reportId],
  );
  if (!rows[0]) continue;
  const report = rows[0];
  const details = Array.isArray(report.summary_json?.rowDetails)
    ? report.summary_json.rowDetails
    : [];
  const kept = details.filter((r) => {
    const day = toLocalYmd(r.transactionDate);
    return !day || !days.has(day);
  });
  const removed = details.length - kept.length;
  totalRowsRemoved += removed;

  if (kept.length === 0) {
    console.log(`DELETE ${reportId} removed=${removed}`);
    if (!DRY) await client.query(`delete from reports_daily where id = $1`, [reportId]);
    totalDeleted += 1;
    continue;
  }

  const keptDays = [
    ...new Set(kept.map((r) => toLocalYmd(r.transactionDate)).filter(Boolean)),
  ].sort();
  const newJson = rebuildSummaryJson(report.summary_json, kept);
  console.log(
    `TRIM ${reportId} days=${days.size} rows=${removed} → ${keptDays[0]}..${keptDays.at(-1)}`,
  );
  if (!DRY) {
    await client.query(
      `
      update reports_daily
      set summary_json = $2::jsonb,
          date_range_start = $3::date,
          date_range_end = $4::date,
          report_date = $3::date,
          updated_at = now()
      where id = $1
    `,
      [reportId, JSON.stringify(newJson), keptDays[0], keptDays.at(-1)],
    );
  }
  totalTrimmed += 1;
}

const verify = await client.query(`
  WITH days AS (
    SELECT
      rd.id AS report_id,
      rd.branch_id,
      ((e->>'transactionDate')::timestamptz AT TIME ZONE 'Asia/Manila')::date AS local_day
    FROM reports_daily rd
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(rd.summary_json->'rowDetails', '[]'::jsonb)) e
    WHERE NULLIF(e->>'transactionDate','') IS NOT NULL
  ),
  remaining AS (
    SELECT branch_id, local_day
    FROM days
    GROUP BY branch_id, local_day
    HAVING COUNT(DISTINCT report_id) > 1
  ),
  range_overlap AS (
    SELECT COUNT(*)::int AS n
    FROM reports_daily a
    JOIN reports_daily b
      ON a.branch_id = b.branch_id
     AND a.id < b.id
     AND a.date_range_start <= b.date_range_end
     AND b.date_range_start <= a.date_range_end
  )
  SELECT
    (SELECT COUNT(*)::int FROM remaining) AS remaining_dup_days,
    (SELECT n FROM range_overlap) AS remaining_meta_range_overlaps
`);

console.log("\n=== SUMMARY ===");
console.log({
  dryRun: DRY,
  rangesNormalized: mismatch.rows.length,
  duplicateDaySlots: dupReportRows.rows.length,
  reportsTrimmed: totalTrimmed,
  reportsDeleted: totalDeleted,
  rowsRemoved: totalRowsRemoved,
  remainingDupDays: verify.rows[0].remaining_dup_days,
  remainingMetaRangeOverlaps: verify.rows[0].remaining_meta_range_overlaps,
});

await client.end();
process.exit(
  !DRY &&
    (verify.rows[0].remaining_dup_days > 0 || verify.rows[0].remaining_meta_range_overlaps > 0)
    ? 1
    : 0,
);
