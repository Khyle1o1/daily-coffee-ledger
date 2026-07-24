import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

function loadEnv(path) {
  const env = {};
  for (const line of fs.readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    env[m[1].trim()] = v;
  }
  return env;
}

async function countReports(label, env) {
  const admin = createClient(env.SUPABASE_URL || env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { count, error } = await admin
    .from('reports_daily')
    .select('*', { count: 'exact', head: true });
  console.log(`${label} url=${env.VITE_SUPABASE_URL || env.SUPABASE_URL}`);
  console.log(`${label} reports_daily=${count ?? 'n/a'} err=${error?.message || 'none'}`);
}

const current = loadEnv('.env');
const backup = loadEnv('.env.backup');
await countReports('LOCAL_NEW', current);
await countReports('OLD_BACKUP', backup);
