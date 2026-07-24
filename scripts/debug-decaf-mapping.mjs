import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import { DEFAULT_MAPPING } from '../src/utils/defaultMapping.ts';
import { mapRow } from '../src/utils/mapRow.ts';

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

const { data: manuals } = await admin
  .from('manual_mappings')
  .select('*')
  .eq('is_active', true)
  .or('source_option.ilike.%decaf%,source_item.ilike.%decaf%,mapped_item_name.ilike.%creatine%,source_option.ilike.%creatine%,source_item.ilike.%misc%,mapped_item_name.ilike.%espresso%');

console.log('MANUALS', JSON.stringify(manuals, null, 2));

const { data: allManuals } = await admin
  .from('manual_mappings')
  .select('source_category,source_item,source_option,mapped_category,mapped_item_name,source_cat_norm,source_item_norm,source_opt_norm')
  .eq('is_active', true)
  .order('priority', { ascending: false });

console.log('ALL_MANUAL_COUNT', allManuals?.length);
for (const m of allManuals || []) {
  console.log(
    `${m.source_category} | ${m.source_item} | ${m.source_option || '(none)'} => ${m.mapped_category} / ${m.mapped_item_name}`,
  );
}

function row(cat, item, opt) {
  return {
    rawCategory: cat,
    rawItemName: item,
    option: opt,
    quantity: 1,
    unitPrice: 35,
  };
}

const cases = [
  ['ADD ONS', 'ADD ONS MISC', 'Decaf Espresso Shot'],
  ['DEL - ADD ONS', 'ADD ONS MISC', 'Decaf Espresso Shot'],
  ['ADD ONS', 'ADD ONS MISC', 'Creatine Wheyl'],
  ['ADD ONS', 'ADD ONS MISC', 'Espresso Shot'],
];

for (const [c, i, o] of cases) {
  const r = mapRow(row(c, i, o), DEFAULT_MAPPING);
  console.log(`DEFAULT_ONLY ${c}|${i}|${o} => ${r.status} ${r.mappedCat}/${r.mappedItemName} reason=${r.debugReason || ''}`);
}
