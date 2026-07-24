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

const url = process.env.VITE_SUPABASE_URL;
const anon = process.env.VITE_SUPABASE_ANON_KEY;
const client = createClient(url, anon);

const email = 'admin@dotcoffee.com';
const password = 'Admin123!';

const { data: auth, error: authErr } = await client.auth.signInWithPassword({
  email,
  password,
});
if (authErr) {
  console.error('LOGIN_FAIL:', authErr.message);
  process.exit(1);
}
console.log('LOGIN_OK', auth.user.id);

const { data: profile, error: profileErr } = await client
  .from('user_profiles')
  .select('email, role')
  .eq('user_id', auth.user.id)
  .maybeSingle();

if (profileErr) {
  console.error('PROFILE_FAIL:', profileErr.message);
  process.exit(1);
}
console.log('PROFILE_OK', profile);

const { data: meta, error: metaErr } = await client
  .from('reports_daily_meta')
  .select('id')
  .limit(1);

if (metaErr) {
  console.error('META_FAIL:', metaErr.message);
  process.exit(1);
}
console.log('META_OK rows=', meta?.length ?? 0);
console.log('ALL_OK');
await client.auth.signOut();
