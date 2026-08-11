import { createClient } from '@supabase/supabase-js';
import { pgQuery } from './migrate-new-db.mjs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const URL =
  'http://supabasekong-nr6zgff7wv4gilid4tf7grw8.187.52.114.150.sslip.io';
const SERVICE_ROLE =
  'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc4NjQzNzM2MCwiZXhwIjo0OTQyMTEwOTYwLCJyb2xlIjoic2VydmljZV9yb2xlIn0.iX66JlFTUL_yNMeLTwclCBFjD_g54zqnSfZ9kHtGbt8';

const ADMIN_EMAIL = 'admin@dot.com';
const ADMIN_PASSWORD = 'Admin123!';

const admin = createClient(URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function runNode(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: root,
      stdio: 'inherit',
    });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Command failed (${code}): node ${args.join(' ')}`));
    });
  });
}

async function deleteAllAuthUsers() {
  console.log('=== Deleting auth users ===');
  const { data, error } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (error) throw error;
  for (const u of data.users) {
    const { error: delErr } = await admin.auth.admin.deleteUser(u.id);
    if (delErr) console.error('delete fail', u.email, delErr.message);
    else console.log('deleted', u.email);
  }
}

async function createDummyAdmin() {
  console.log('=== Creating dummy admin ===');
  const { data, error } = await admin.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    email_confirm: true,
  });
  if (error) throw error;
  const userId = data.user.id;
  console.log('auth user:', userId);

  const { error: pErr } = await admin.from('user_profiles').upsert(
    {
      user_id: userId,
      email: ADMIN_EMAIL,
      role: 'admin',
      created_by: null,
      is_archived: false,
      archived_at: null,
    },
    { onConflict: 'user_id' },
  );
  if (pErr) throw pErr;
  console.log('profile: admin role ok');
}

async function verify() {
  const tables = await pgQuery(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema='public' ORDER BY 1
  `);
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
  const { data: users } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 50,
  });
  console.log('\n=== Fresh DB ready ===');
  console.log('tables:', tables.map((t) => t.table_name));
  console.log('counts:', counts);
  console.log(
    'auth users:',
    users.users.map((u) => u.email),
  );
  console.log('\nLogin:');
  console.log(`  email:    ${ADMIN_EMAIL}`);
  console.log(`  password: ${ADMIN_PASSWORD}`);
}

await deleteAllAuthUsers();
await runNode([
  'scripts/migrate-new-db.mjs',
  'apply',
  'supabase/migrations/FULL_SCHEMA.sql',
  '--reset',
]);
await createDummyAdmin();
await verify();
