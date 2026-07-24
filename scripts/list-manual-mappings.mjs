import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

function loadEnv() {
  for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
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

const { data: allManuals, error } = await admin
  .from('manual_mappings')
  .select('source_category,source_item,source_option,mapped_category,mapped_item_name,priority,is_active')
  .eq('is_active', true)
  .order('priority', { ascending: false });

if (error) {
  console.error(error);
  process.exit(1);
}

console.log('ALL_MANUAL_COUNT', allManuals?.length);
for (const m of allManuals || []) {
  console.log(
    `${m.source_category} | ${m.source_item} | ${m.source_option || '(none)'} => ${m.mapped_category} / ${m.mapped_item_name}`,
  );
}
