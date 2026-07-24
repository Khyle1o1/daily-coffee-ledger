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
    if (!(m[1].trim() in process.env)) process.env[m[1].trim()] = v;
  }
}

function n(s) {
  if (!s) return '';
  let t = s.trim().toLowerCase();
  t = t.replace(/^["']+|["']+$/g, '');
  t = t.replace(/[\u00A0\u200B\u2007\u202F\uFEFF]/g, ' ');
  t = t.replace(/\s+/g, ' ');
  t = t.replace(/[\u2013\u2014]/g, '-');
  t = t.replace(/(\d)(oz|ml|g)\b/gi, '$1 $2');
  return t.trim();
}

function normOption(opt) {
  let t = n(opt);
  t = t.replace(/\(\s*(\d+\s*oz)\s*\)/g, '$1');
  t = t.replace(/\(\s*[+-]?\s*\d+\s*\)/g, '');
  t = t.replace(/\boz\./g, 'oz');
  t = t.replace(/\.$/, '');
  t = t.replace(/\s*\|\s*/g, ' | ');
  t = t.replace(/\s+/g, ' ');
  return t.trim();
}

loadEnv();

const rows = [
  {
    source_category: 'PROMO',
    source_item: 'Klook Kreators',
    source_option: 'Free Drink 16oz Iced',
    mapped_category: 'PROMO',
    mapped_item_name: 'Klook Kreators',
    notes: 'Seeded: promo free drink',
  },
  {
    source_category: 'PACKAGING',
    source_item: 'Sugar Granules',
    source_option: '',
    mapped_category: 'PACKAGING',
    mapped_item_name: 'Sugar Granules',
    notes: 'Seeded: packaging modifier',
  },
].map((r) => ({
  ...r,
  priority: 100,
  is_active: true,
  source_cat_norm: n(r.source_category),
  source_item_norm: n(r.source_item),
  source_opt_norm: normOption(r.source_option),
}));

const admin = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

for (const row of rows) {
  const { data: ex, error: findErr } = await admin
    .from('manual_mappings')
    .select('id')
    .eq('source_cat_norm', row.source_cat_norm)
    .eq('source_item_norm', row.source_item_norm)
    .eq('source_opt_norm', row.source_opt_norm)
    .eq('is_active', true)
    .maybeSingle();
  if (findErr) throw findErr;

  if (ex?.id) {
    const { error } = await admin
      .from('manual_mappings')
      .update({
        mapped_category: row.mapped_category,
        mapped_item_name: row.mapped_item_name,
        notes: row.notes,
        priority: 100,
        is_active: true,
      })
      .eq('id', ex.id);
    if (error) throw error;
    console.log('UPDATED', row.source_item, row.source_option || '(none)');
  } else {
    const { error } = await admin.from('manual_mappings').insert(row);
    if (error) throw error;
    console.log('INSERTED', row.source_item, row.source_option || '(none)');
  }
}
