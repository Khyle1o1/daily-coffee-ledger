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

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('Missing SUPABASE_URL or SERVICE_ROLE_KEY');
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const email = process.env.DUMMY_ADMIN_EMAIL || 'admin@dotcoffee.com';
const password = process.env.DUMMY_ADMIN_PASSWORD || 'Admin123!';

const { data: existing, error: listErr } = await admin.auth.admin.listUsers({
  page: 1,
  perPage: 1000,
});
if (listErr) {
  console.error('listUsers failed:', listErr.message);
  process.exit(1);
}

let user = existing.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());

if (!user) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role: 'admin' },
  });
  if (error) {
    console.error('createUser failed:', error.message);
    process.exit(1);
  }
  user = data.user;
  console.log('Created auth user:', user.id);
} else {
  await admin.auth.admin.updateUserById(user.id, {
    password,
    email_confirm: true,
    app_metadata: { ...(user.app_metadata || {}), role: 'admin' },
  });
  console.log('Updated existing auth user:', user.id);
}

const { data: profile, error: profileErr } = await admin
  .from('user_profiles')
  .upsert(
    {
      user_id: user.id,
      email,
      role: 'admin',
      created_by: null,
    },
    { onConflict: 'user_id' }
  )
  .select('*')
  .single();

if (profileErr) {
  console.error('profile upsert failed:', profileErr.message);
  process.exit(1);
}

console.log('Admin profile ready:', profile.email, profile.role);

const { data: branches, error: branchErr } = await admin
  .from('branches')
  .select('id, name, label')
  .limit(20);

if (branchErr) {
  console.error('branches smoke test failed:', branchErr.message);
  process.exit(1);
}

console.log('Branches count:', branches?.length ?? 0);
console.log('SMOKE_OK');
console.log(`LOGIN_EMAIL=${email}`);
console.log(`LOGIN_PASSWORD=${password}`);
