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

const { data: branches } = await admin.from('branches').select('id,name,label');
console.log('branches', branches);
const byId = Object.fromEntries((branches || []).map((b) => [b.id, b.name]));

const { data: reports } = await admin
  .from('reports_daily')
  .select('id,branch_id,report_date,date_range_start,date_range_end')
  .order('date_range_start');
for (const r of reports || []) {
  console.log(
    byId[r.branch_id],
    r.date_range_start,
    '→',
    r.date_range_end,
    'report_date',
    r.report_date,
  );
}

const { data: julyReports } = await admin
  .from('reports_daily')
  .select('id,branch_id,summary_json')
  .gte('date_range_start', '2026-07-01')
  .lte('date_range_start', '2026-07-31');

for (const one of julyReports || []) {
  const rows = one.summary_json?.rowDetails || [];
  const interesting = rows.filter(
    (r) =>
      ['MERCH', 'LOYALTY CARD', 'PROMO'].includes(r.mappedCat) ||
      String(r.rawCategory || '')
        .toUpperCase()
        .includes('MERCH') ||
      String(r.rawCategory || '')
        .toUpperCase()
        .includes('LOYALTY') ||
      String(r.rawCategory || '')
        .toUpperCase()
        .includes('PROMO') ||
      /gift|voucher|lc |loyalty|tumbler|tote|merch/i.test(
        `${r.rawItemName || ''}${r.mappedItemName || ''}${r.option || ''}`,
      ),
  );
  console.log('\nbranch', byId[one.branch_id], 'interesting', interesting.length);
  const byCat = {};
  for (const r of interesting) {
    const k = `${r.rawCategory} | ${r.rawItemName} | ${r.option || ''} => ${r.mappedCat}/${r.mappedItemName} sales=${r.rowSales} status=${r.status}`;
    byCat[k] = (byCat[k] || 0) + 1;
  }
  console.log(
    Object.entries(byCat)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50),
  );
  console.log('summaryTotals', one.summary_json?.summaryTotalsByCat);
}
