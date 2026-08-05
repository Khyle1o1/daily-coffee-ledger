import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

function loadEnv() {
  for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    process.env[m[1].trim()] = v;
  }
}

loadEnv();

const admin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const { data: branches } = await admin.from('branches').select('id, name, label');
const byName = Object.fromEntries((branches || []).map((b) => [b.name, b.id]));
const byId = Object.fromEntries((branches || []).map((b) => [b.id, b.name]));

const { data: reports } = await admin
  .from('reports_daily')
  .select('id, branch_id, report_date, date_range_start, date_range_end, summary_json')
  .gte('date_range_start', '2026-07-01')
  .lte('date_range_start', '2026-07-31');

console.log('July reports:', reports?.length);
for (const r of reports || []) {
  const totals = r.summary_json?.totals || r.summary_json?.summaryTotalsByCat || {};
  const cats = r.summary_json?.summaryTotalsByCat || r.summary_json?.totalsByCat || totals;
  // try common shapes
  let merch = 0;
  let loyalty = 0;
  let promo = 0;
  const sj = r.summary_json || {};
  if (sj.summaryTotalsByCat) {
    merch = sj.summaryTotalsByCat.MERCH ?? 0;
    loyalty = sj.summaryTotalsByCat['LOYALTY CARD'] ?? 0;
    promo = sj.summaryTotalsByCat.PROMO ?? 0;
  } else if (sj.totals) {
    merch = sj.totals.MERCH ?? 0;
    loyalty = sj.totals['LOYALTY CARD'] ?? 0;
    promo = sj.totals.PROMO ?? 0;
  }

  // also scan rowDetails if present
  const rows = sj.rowDetails || [];
  let merchRows = 0, loyaltyRows = 0, merchSales = 0, loyaltySales = 0;
  let rawMerch = 0, rawLoyalty = 0;
  for (const row of rows) {
    if (row.mappedCat === 'MERCH') { merchRows++; merchSales += row.rowSales || 0; }
    if (row.mappedCat === 'LOYALTY CARD') { loyaltyRows++; loyaltySales += row.rowSales || 0; }
    if (String(row.rawCategory || '').toUpperCase().includes('MERCH')) rawMerch++;
    if (String(row.rawCategory || '').toUpperCase().includes('LOYALTY')) rawLoyalty++;
  }

  console.log({
    branch: byId[r.branch_id],
    range: `${r.date_range_start}→${r.date_range_end}`,
    summaryMerch: merch,
    summaryLoyalty: loyalty,
    summaryPromo: promo,
    detailMerchRows: merchRows,
    detailMerchSales: merchSales,
    detailLoyaltyRows: loyaltyRows,
    detailLoyaltySales: loyaltySales,
    rawMerchRows: rawMerch,
    rawLoyaltyRows: rawLoyalty,
    rowDetailsCount: rows.length,
    summaryKeys: Object.keys(sj).slice(0, 20),
  });
}
