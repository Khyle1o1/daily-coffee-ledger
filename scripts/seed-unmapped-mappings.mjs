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

function normalizeText(s) {
  if (!s) return '';
  let t = s.trim().toLowerCase();
  t = t.replace(/^["']+|["']+$/g, '');
  t = t.replace(/[\u00A0\u200B\u2007\u202F\uFEFF]/g, ' ');
  t = t.replace(/\s+/g, ' ');
  t = t.replace(/[\u2013\u2014]/g, '-');
  t = t.replace(/(\d)(oz|ml|g)\b/gi, '$1 $2');
  return t.trim();
}

loadEnv();

const rows = [
  {
    source_category: 'ADD ONS',
    source_item: 'ADD ONS FOAM',
    source_option: 'Hojicha Cold Foam',
    mapped_category: 'ADD-ONS',
    mapped_item_name: 'Hojicha Cold Foam',
    notes: 'Seeded: foam bucket option',
  },
  {
    source_category: 'DEL - ADD ONS',
    source_item: 'ADD ONS FOAM',
    source_option: 'Hojicha Cold Foam',
    mapped_category: 'ADD-ONS',
    mapped_item_name: 'Hojicha Cold Foam',
    notes: 'Seeded: delivery foam bucket option',
  },
  {
    source_category: 'PACKAGING',
    source_item: 'Less Ice',
    source_option: '',
    mapped_category: 'PACKAGING',
    mapped_item_name: 'Less Ice',
    notes: 'Seeded: packaging modifier',
  },
  {
    source_category: 'PACKAGING',
    source_item: 'Less Sweet',
    source_option: '',
    mapped_category: 'PACKAGING',
    mapped_item_name: 'Less Sweet',
    notes: 'Seeded: packaging modifier',
  },
].map((r) => ({
  ...r,
  priority: 100,
  is_active: true,
  source_cat_norm: normalizeText(r.source_category),
  source_item_norm: normalizeText(r.source_item),
  source_opt_norm: normalizeText(r.source_option),
}));

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const admin = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

for (const row of rows) {
  const { data: existing, error: findErr } = await admin
    .from('manual_mappings')
    .select('id')
    .eq('source_cat_norm', row.source_cat_norm)
    .eq('source_item_norm', row.source_item_norm)
    .eq('source_opt_norm', row.source_opt_norm)
    .eq('is_active', true)
    .maybeSingle();

  if (findErr) {
    console.error('FIND_FAIL', row.source_item, findErr.message);
    process.exitCode = 1;
    continue;
  }

  if (existing?.id) {
    const { error } = await admin
      .from('manual_mappings')
      .update({
        mapped_category: row.mapped_category,
        mapped_item_name: row.mapped_item_name,
        notes: row.notes,
        priority: row.priority,
        is_active: true,
      })
      .eq('id', existing.id);
    if (error) {
      console.error('UPDATE_FAIL', row.source_item, error.message);
      process.exitCode = 1;
    } else {
      console.log('UPDATED', row.source_category, '/', row.source_item, '/', row.source_option || '(none)');
    }
  } else {
    const { error } = await admin.from('manual_mappings').insert(row);
    if (error) {
      console.error('INSERT_FAIL', row.source_item, error.message);
      process.exitCode = 1;
    } else {
      console.log('INSERTED', row.source_category, '/', row.source_item, '/', row.source_option || '(none)');
    }
  }
}

console.log('DONE');
