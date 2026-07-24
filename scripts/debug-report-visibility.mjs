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

const anon = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const { data: reports } = await admin
  .from('reports_daily')
  .select('id, report_date, date_range_start, date_range_end, branch_id, created_at, user_id')
  .order('created_at', { ascending: false });

const { data: branches } = await admin.from('branches').select('id, name, label');
const branchMap = Object.fromEntries((branches || []).map((b) => [b.id, b.name]));

console.log('ADMIN_REPORTS', (reports || []).length);
for (const r of reports || []) {
  console.log(
    '-',
    r.report_date,
    branchMap[r.branch_id] || r.branch_id,
    'range',
    r.date_range_start,
    '→',
    r.date_range_end,
  );
}

const { data: auth, error: loginErr } = await anon.auth.signInWithPassword({
  email: 'admin@dotcoffee.com',
  password: 'Admin123!',
});
if (loginErr) {
  console.error('LOGIN_FAIL', loginErr.message);
  process.exit(1);
}

const userClient = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: { Authorization: `Bearer ${auth.session.access_token}` },
    },
  },
);

const { data: asUser, error: userErr } = await userClient
  .from('reports_daily')
  .select('id, report_date')
  .limit(20);
console.log('AS_USER_COUNT', asUser?.length ?? 0, userErr?.message || 'ok');

const { data: meta, error: metaErr } = await userClient
  .from('reports_daily_meta')
  .select('id, report_date')
  .limit(20);
console.log('AS_USER_META', meta?.length ?? 0, metaErr?.message || 'ok');
