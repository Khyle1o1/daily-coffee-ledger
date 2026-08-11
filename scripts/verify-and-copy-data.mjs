import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

const newUrl =
  'http://supabasekong-nr6zgff7wv4gilid4tf7grw8.187.52.114.150.sslip.io';
const newSvc =
  'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc4NjQzNzM2MCwiZXhwIjo0OTQyMTEwOTYwLCJyb2xlIjoic2VydmljZV9yb2xlIn0.iX66JlFTUL_yNMeLTwclCBFjD_g54zqnSfZ9kHtGbt8';

const oldUrl = 'https://qdhlnhzkcqjsewrucfxk.supabase.co';
const oldSvc =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFkaGxuaHprY3Fqc2V3cnVjZnhrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTMzMzk0OSwiZXhwIjoyMDg2OTA5OTQ5fQ.2Oiatk-nctmzkz81Q5Xl_2B915LXZp6pzMQCsG-8WgQ';

const TEMP_PASSWORD = 'DotCoffee!Migrate2026';

const neu = createClient(newUrl, newSvc, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const old = createClient(oldUrl, oldSvc, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function fetchAll(client, table, select = '*') {
  const pageSize = 1000;
  let from = 0;
  const all = [];
  for (;;) {
    const { data, error } = await client
      .from(table)
      .select(select)
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    all.push(...(data || []));
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

async function upsertChunks(client, table, rows, onConflict = 'id') {
  const chunk = 100;
  let n = 0;
  for (let i = 0; i < rows.length; i += chunk) {
    const slice = rows.slice(i, i + chunk);
    const { error } = await client.from(table).upsert(slice, { onConflict });
    if (error) throw new Error(`${table} upsert: ${error.message}`);
    n += slice.length;
  }
  return n;
}

async function migrateUsers() {
  const userMap = new Map(); // oldUserId -> newUserId
  const { data: listed, error } = await old.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (error) throw error;

  const profiles = await fetchAll(old, 'user_profiles');
  const profileByUser = new Map(profiles.map((p) => [p.user_id, p]));

  for (const u of listed.users) {
    const profile = profileByUser.get(u.id);
    console.log(`Creating user ${u.email}...`);

    // Try create; if exists, look up
    const { data: created, error: cerr } = await neu.auth.admin.createUser({
      email: u.email,
      password: TEMP_PASSWORD,
      email_confirm: true,
      user_metadata: u.user_metadata || {},
      app_metadata: u.app_metadata || {},
    });

    let newId;
    if (cerr) {
      // already exists?
      const { data: existing } = await neu.auth.admin.listUsers({
        page: 1,
        perPage: 200,
      });
      const found = existing?.users?.find(
        (x) => x.email?.toLowerCase() === u.email?.toLowerCase(),
      );
      if (!found) {
        console.error(`  fail ${u.email}: ${cerr.message}`);
        continue;
      }
      newId = found.id;
      console.log(`  already exists -> ${newId}`);
    } else {
      newId = created.user.id;
      console.log(`  created -> ${newId}`);
    }

    userMap.set(u.id, newId);

    if (profile) {
      const payload = {
        ...profile,
        user_id: newId,
        // keep same id if possible? user_profiles PK is usually user_id
      };
      // user_profiles typically keyed by user_id
      const { id, ...rest } = payload;
      const row = { ...rest, user_id: newId };
      const { error: perr } = await neu.from('user_profiles').upsert(row, {
        onConflict: 'user_id',
      });
      if (perr) {
        // try with id preserved if schema has separate id
        const { error: perr2 } = await neu.from('user_profiles').upsert(
          { ...profile, user_id: newId },
          { onConflict: 'user_id' },
        );
        if (perr2) console.error(`  profile fail: ${perr2.message}`);
        else console.log('  profile ok');
      } else {
        console.log('  profile ok');
      }
    }
  }

  return userMap;
}

async function migrateBranches() {
  const oldBranches = await fetchAll(old, 'branches');
  const newBranches = await fetchAll(neu, 'branches');
  const byName = new Map(newBranches.map((b) => [b.name, b]));
  const branchMap = new Map();

  for (const b of oldBranches) {
    let match = byName.get(b.name);
    if (!match) {
      const { id, created_at, updated_at, ...rest } = b;
      const { data, error } = await neu
        .from('branches')
        .insert(rest)
        .select('*')
        .single();
      if (error) {
        // maybe name check constraint — insert with generated-friendly fields
        console.error(`branch insert ${b.name}: ${error.message}`);
        // try upsert by code if present
        if (b.code) {
          const { data: d2, error: e2 } = await neu
            .from('branches')
            .upsert(
              {
                name: b.name,
                label: b.label,
                code: b.code,
                is_active: b.is_active ?? true,
                sort_order: b.sort_order ?? 0,
              },
              { onConflict: 'code' },
            )
            .select('*')
            .single();
          if (e2) {
            console.error(`branch upsert ${b.name}: ${e2.message}`);
            continue;
          }
          match = d2;
        } else continue;
      } else {
        match = data;
      }
      byName.set(match.name, match);
    } else {
      await neu
        .from('branches')
        .update({
          label: b.label,
          code: b.code,
          is_active: b.is_active,
          sort_order: b.sort_order,
        })
        .eq('id', match.id);
    }
    branchMap.set(b.id, match.id);
  }

  console.log(`branches mapped: ${branchMap.size}/${oldBranches.length}`);
  return branchMap;
}

function remapRow(row, branchMap, userMap, { dropUser = false } = {}) {
  const copy = { ...row };
  if (copy.branch_id) {
    const mapped = branchMap.get(copy.branch_id);
    if (!mapped) return null;
    copy.branch_id = mapped;
  }
  if ('user_id' in copy) {
    if (dropUser) copy.user_id = null;
    else if (copy.user_id) {
      const mapped = userMap.get(copy.user_id);
      copy.user_id = mapped || null;
    }
  }
  return copy;
}

async function main() {
  console.log('=== Migrating users ===');
  const userMap = await migrateUsers();
  console.log(`users mapped: ${userMap.size}`);

  console.log('\n=== Migrating branches ===');
  const branchMap = await migrateBranches();

  console.log('\n=== Migrating tables ===');
  for (const table of [
    'manual_mappings',
    'directory_links',
    'reports_daily',
    'reports_monthly',
    'daily_ledger_entries',
  ]) {
    const rows = await fetchAll(old, table);
    const needsBranch = [
      'reports_daily',
      'reports_monthly',
      'daily_ledger_entries',
    ].includes(table);
    const mapped = rows
      .map((r) =>
        remapRow(r, branchMap, userMap, {
          dropUser: false,
        }),
      )
      .filter(Boolean)
      .filter((r) => !needsBranch || r.branch_id);

    // For tables without branch_id
    if (!needsBranch) {
      const cleaned = rows.map((r) => {
        const c = { ...r };
        if ('user_id' in c && c.user_id) {
          c.user_id = userMap.get(c.user_id) || null;
        }
        if ('created_by' in c && c.created_by) {
          c.created_by = userMap.get(c.created_by) || null;
        }
        return c;
      });
      const n = await upsertChunks(neu, table, cleaned);
      console.log(`${table}: ${n}`);
      continue;
    }

    const n = await upsertChunks(neu, table, mapped);
    console.log(`${table}: ${n} (from ${rows.length})`);
  }

  // audit logs (optional, can be large)
  console.log('\n=== Migrating audit_logs ===');
  try {
    const logs = await fetchAll(old, 'audit_logs');
    const mapped = logs.map((r) => {
      const c = { ...r };
      if (c.user_id) c.user_id = userMap.get(c.user_id) || null;
      return c;
    });
    const n = await upsertChunks(neu, 'audit_logs', mapped);
    console.log(`audit_logs: ${n}`);
  } catch (e) {
    console.error('audit_logs skipped:', e.message);
  }

  console.log('\n=== Final counts (new) ===');
  for (const t of [
    'branches',
    'reports_daily',
    'manual_mappings',
    'directory_links',
    'user_profiles',
    'audit_logs',
  ]) {
    const { count, error } = await neu
      .from(t)
      .select('*', { count: 'exact', head: true });
    console.log(t, error?.message || count);
  }

  console.log('\nTemporary password for all migrated users:');
  console.log(TEMP_PASSWORD);
  console.log('Ask users to reset passwords after login.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
