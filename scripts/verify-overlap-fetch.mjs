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

const dateFrom = '2026-07-01';
const dateTo = '2026-07-31';

const { data: byReportDate } = await admin
  .from('reports_daily')
  .select('id, report_date, date_range_start, date_range_end, branch:branches(name)')
  .gte('report_date', dateFrom)
  .lte('report_date', dateTo);

const { data: byOverlap } = await admin
  .from('reports_daily')
  .select('id, report_date, date_range_start, date_range_end, branch:branches(name)')
  .lte('date_range_start', dateTo)
  .gte('date_range_end', dateFrom);

console.log('OLD report_date filter count:', byReportDate?.length);
console.log(
  'OLD branches:',
  (byReportDate || []).map((r) => `${r.branch?.name} ${r.date_range_start}→${r.date_range_end}`),
);
console.log('NEW overlap filter count:', byOverlap?.length);
console.log(
  'NEW branches:',
  (byOverlap || []).map((r) => `${r.branch?.name} ${r.date_range_start}→${r.date_range_end}`),
);
