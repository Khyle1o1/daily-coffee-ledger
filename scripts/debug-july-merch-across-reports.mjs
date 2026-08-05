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
const byId = Object.fromEntries((branches || []).map((b) => [b.id, b.name]));

// Reports that overlap July 2026
const { data: reports } = await admin
  .from('reports_daily')
  .select('id,branch_id,date_range_start,date_range_end,summary_json')
  .lte('date_range_start', '2026-07-31')
  .gte('date_range_end', '2026-07-01');

const from = new Date('2026-07-01T00:00:00');
const to = new Date('2026-07-31T23:59:59');

const agg = {
  MERCH: 0,
  'LOYALTY CARD': 0,
  PROMO: 0,
  ICED: 0,
  HOT: 0,
  SNACKS: 0,
  'ADD-ONS': 0,
  PACKAGING: 0,
};
const merchLike = {};
const loyaltyLike = {};
const rawMerchMappedElsewhere = {};

let julyRows = 0;
for (const r of reports || []) {
  for (const row of r.summary_json?.rowDetails || []) {
    // transactionDate may be ISO string when loaded from JSON
    const td = row.transactionDate ? new Date(row.transactionDate) : null;
    if (!td || Number.isNaN(td.getTime())) continue;
    if (td < from || td > to) continue;
    if (row.status !== 'MAPPED' || !row.mappedCat) continue;
    julyRows++;
    agg[row.mappedCat] = (agg[row.mappedCat] || 0) + (row.rowSales || 0);

    const raw = String(row.rawCategory || '').toUpperCase();
    const key = `${byId[r.branch_id]} | ${row.rawCategory} | ${row.rawItemName} | ${row.option || ''} => ${row.mappedCat}/${row.mappedItemName} @${row.rowSales}`;

    if (row.mappedCat === 'MERCH' || /MERCH/.test(raw)) {
      merchLike[key] = (merchLike[key] || 0) + 1;
      if (/MERCH/.test(raw) && row.mappedCat !== 'MERCH') {
        rawMerchMappedElsewhere[key] = (rawMerchMappedElsewhere[key] || 0) + 1;
      }
    }
    if (row.mappedCat === 'LOYALTY CARD' || /LOYALTY/.test(raw)) {
      loyaltyLike[key] = (loyaltyLike[key] || 0) + 1;
    }
  }
}

console.log('reports overlapping July', reports?.length);
console.log('july mapped rows', julyRows);
console.log('july sales by mappedCat', agg);
console.log('\nMERCH-like (top 30)');
console.log(
  Object.entries(merchLike)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30),
);
console.log('\nLOYALTY-like (top 30)');
console.log(
  Object.entries(loyaltyLike)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30),
);
console.log('\nRaw MERCH mapped elsewhere (top 30)');
console.log(
  Object.entries(rawMerchMappedElsewhere)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30),
);
