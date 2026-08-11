import { createClient } from '@supabase/supabase-js';
import { pgQuery } from './migrate-new-db.mjs';

const URL =
  'http://supabasekong-nr6zgff7wv4gilid4tf7grw8.187.52.114.150.sslip.io';
const KEY =
  'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc4NjQzNzM2MCwiZXhwIjo0OTQyMTEwOTYwLCJyb2xlIjoic2VydmljZV9yb2xlIn0.iX66JlFTUL_yNMeLTwclCBFjD_g54zqnSfZ9kHtGbt8';

const EMAIL = 'admin@dot.com';
const PASS = 'Admin123!';

const admin = createClient(URL, KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

console.log('auth before', await pgQuery('SELECT id, email FROM auth.users'));

await pgQuery('TRUNCATE auth.refresh_tokens CASCADE');
await pgQuery('TRUNCATE auth.sessions CASCADE');
await pgQuery('TRUNCATE auth.mfa_amr_claims CASCADE');
await pgQuery('TRUNCATE auth.mfa_challenges CASCADE');
await pgQuery('TRUNCATE auth.mfa_factors CASCADE');
await pgQuery('TRUNCATE auth.identities CASCADE');
await pgQuery('TRUNCATE auth.users CASCADE');

console.log('auth after truncate', await pgQuery('SELECT id, email FROM auth.users'));

const { data, error } = await admin.auth.admin.createUser({
  email: EMAIL,
  password: PASS,
  email_confirm: true,
});
if (error) throw error;
console.log('created auth user', data.user.id);

const { error: pErr } = await admin.from('user_profiles').upsert(
  {
    user_id: data.user.id,
    email: EMAIL,
    role: 'admin',
    created_by: null,
    is_archived: false,
    archived_at: null,
  },
  { onConflict: 'user_id' },
);
if (pErr) throw pErr;

const anon = createClient(
  URL,
  'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc4NjQzNzM2MCwiZXhwIjo0OTQyMTEwOTYwLCJyb2xlIjoiYW5vbiJ9._8EUsSWZztalUK6S8ruc6Zk0Kxq9dm0iK_B4Kv0Tzcs',
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const { data: login, error: lErr } = await anon.auth.signInWithPassword({
  email: EMAIL,
  password: PASS,
});
console.log('login test:', lErr?.message || `ok as ${login.user.email}`);

const counts = {};
for (const t of [
  'branches',
  'reports_daily',
  'manual_mappings',
  'directory_links',
  'user_profiles',
  'audit_logs',
  'daily_ledger_entries',
]) {
  const [{ c }] = await pgQuery(`SELECT count(*)::int AS c FROM public.${t}`);
  counts[t] = c;
}
console.log('counts', counts);
console.log('\nDummy admin ready:');
console.log(`  email:    ${EMAIL}`);
console.log(`  password: ${PASS}`);
