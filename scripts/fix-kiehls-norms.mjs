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

function n(s) {
  if (!s) return '';
  let t = s.trim().toLowerCase();
  t = t.replace(/^["']+|["']+$/g, '');
  t = t.replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'");
  t = t.replace(/[\u00A0\u200B\u2007\u202F\uFEFF]/g, ' ');
  t = t.replace(/\s+/g, ' ');
  t = t.replace(/[\u2013\u2014]/g, '-');
  t = t.replace(/(\d)(oz|ml|g)\b/gi, '$1 $2');
  return t.trim();
}

loadEnv();

const admin = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const { data: rows, error } = await admin
  .from('manual_mappings')
  .select('*')
  .ilike('source_item', '%kiehl%');
if (error) throw error;

console.log('before', rows?.map((r) => ({ id: r.id, item: r.source_item, norm: r.source_item_norm, pri: r.priority })));

// Keep the highest-priority active row; normalize its norms; deactivate duplicates.
const sorted = [...(rows || [])].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
const keep = sorted[0];
if (!keep) {
  console.log('No Kiehl rows');
  process.exit(0);
}

const { error: upErr } = await admin
  .from('manual_mappings')
  .update({
    source_item: "Kiehl'sVoucher",
    mapped_item_name: "Kiehl'sVoucher",
    source_item_norm: n("Kiehl'sVoucher"),
    source_cat_norm: n('PROMO'),
    source_opt_norm: '',
    is_active: true,
    priority: 100,
    notes: 'Normalized apostrophe variants for POS matching',
  })
  .eq('id', keep.id);
if (upErr) throw upErr;
console.log('KEPT', keep.id);

for (const dup of sorted.slice(1)) {
  const { error: dErr } = await admin
    .from('manual_mappings')
    .update({ is_active: false, notes: 'Deactivated duplicate Kiehl apostrophe variant' })
    .eq('id', dup.id);
  if (dErr) throw dErr;
  console.log('DEACTIVATED', dup.id);
}
