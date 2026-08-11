import { createClient } from '@supabase/supabase-js';

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

async function listAllUsers(client) {
  const { data, error } = await client.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (error) throw error;
  return data.users;
}

async function fetchPaged(client, table, { select = '*', pageSize = 20 } = {}) {
  const all = [];
  let from = 0;
  for (;;) {
    const { data, error } = await client
      .from(table)
      .select(select)
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    all.push(...(data || []));
    console.log(`  fetched ${all.length} ${table}...`);
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

async function buildMaps() {
  const oldUsers = await listAllUsers(old);
  const newUsers = await listAllUsers(neu);
  const newByEmail = new Map(
    newUsers.map((u) => [u.email?.toLowerCase(), u.id]),
  );
  const userMap = new Map();
  for (const u of oldUsers) {
    const nid = newByEmail.get(u.email?.toLowerCase());
    if (nid) userMap.set(u.id, nid);
  }

  const oldBranches = await fetchPaged(old, 'branches', { pageSize: 100 });
  const newBranches = await fetchPaged(neu, 'branches', { pageSize: 100 });
  const byName = new Map(newBranches.map((b) => [b.name, b.id]));
  const branchMap = new Map();
  for (const b of oldBranches) {
    if (byName.has(b.name)) branchMap.set(b.id, byName.get(b.name));
  }
  return { userMap, branchMap };
}

async function fixProfiles(userMap) {
  console.log('=== Fixing user_profiles ===');
  const { data: profiles, error } = await old.from('user_profiles').select('*');
  if (error) throw error;

  // First pass: upsert without created_by
  for (const p of profiles) {
    const newUserId = userMap.get(p.user_id);
    if (!newUserId) {
      console.warn('no user map for', p.email);
      continue;
    }
    const row = {
      email: p.email,
      role: p.role,
      user_id: newUserId,
      is_archived: p.is_archived ?? false,
      archived_at: p.archived_at,
      created_by: null,
    };
    const { error: e } = await neu
      .from('user_profiles')
      .upsert(row, { onConflict: 'user_id' });
    if (e) console.error('profile', p.email, e.message);
    else console.log('profile ok', p.email, p.role);
  }

  // Second pass: set created_by now that all profiles/users exist
  for (const p of profiles) {
    const newUserId = userMap.get(p.user_id);
    const newCreatedBy = p.created_by ? userMap.get(p.created_by) : null;
    if (!newUserId || !newCreatedBy) continue;
    const { error: e } = await neu
      .from('user_profiles')
      .update({ created_by: newCreatedBy })
      .eq('user_id', newUserId);
    if (e) console.error('created_by', p.email, e.message);
  }
}

async function copyReports(branchMap, userMap) {
  console.log('=== Copying reports_daily (small pages) ===');
  const rows = await fetchPaged(old, 'reports_daily', { pageSize: 5 });
  let ok = 0;
  for (const r of rows) {
    const branch_id = branchMap.get(r.branch_id);
    if (!branch_id) {
      console.warn('skip report missing branch', r.id);
      continue;
    }
    const row = {
      ...r,
      branch_id,
      user_id: r.user_id ? userMap.get(r.user_id) || null : null,
    };
    const { error } = await neu.from('reports_daily').upsert(row, {
      onConflict: 'id',
    });
    if (error) {
      // try without preserving id
      const { id, ...rest } = row;
      const { error: e2 } = await neu.from('reports_daily').upsert(rest, {
        onConflict: 'branch_id,report_date',
      });
      if (e2) {
        console.error('report fail', r.id, e2.message);
        continue;
      }
    }
    ok += 1;
    if (ok % 10 === 0) console.log(`  upserted ${ok}/${rows.length}`);
  }
  console.log(`reports_daily done: ${ok}/${rows.length}`);
}

async function copyMonthly(branchMap, userMap) {
  const rows = await fetchPaged(old, 'reports_monthly', { pageSize: 50 });
  if (!rows.length) {
    console.log('reports_monthly: 0');
    return;
  }
  const mapped = rows
    .map((r) => ({
      ...r,
      branch_id: r.branch_id ? branchMap.get(r.branch_id) : null,
      user_id: r.user_id ? userMap.get(r.user_id) || null : null,
    }))
    .filter((r) => r.branch_id || r.branch_id === null);
  const { error } = await neu.from('reports_monthly').upsert(mapped, {
    onConflict: 'id',
  });
  if (error) throw error;
  console.log('reports_monthly:', mapped.length);
}

async function copyAudit(userMap) {
  console.log('=== Copying audit_logs ===');
  const rows = await fetchPaged(old, 'audit_logs', { pageSize: 100 });
  let ok = 0;
  const chunk = 50;
  for (let i = 0; i < rows.length; i += chunk) {
    const slice = rows.slice(i, i + chunk).map((r) => ({
      ...r,
      user_id: r.user_id ? userMap.get(r.user_id) || null : null,
    }));
    const { error } = await neu.from('audit_logs').upsert(slice, {
      onConflict: 'id',
    });
    if (error) {
      console.error('audit chunk fail', error.message);
      continue;
    }
    ok += slice.length;
    console.log(`  audit ${ok}/${rows.length}`);
  }
}

async function counts() {
  console.log('\n=== New DB counts ===');
  for (const t of [
    'branches',
    'reports_daily',
    'reports_monthly',
    'manual_mappings',
    'directory_links',
    'user_profiles',
    'audit_logs',
    'daily_ledger_entries',
  ]) {
    const { count, error } = await neu
      .from(t)
      .select('*', { count: 'exact', head: true });
    console.log(t, error?.message || count);
  }
  const users = await listAllUsers(neu);
  console.log(
    'auth users',
    users.map((u) => u.email),
  );
  console.log('\nTemp password for migrated users:', TEMP_PASSWORD);
}

const { userMap, branchMap } = await buildMaps();
console.log('maps', { users: userMap.size, branches: branchMap.size });
await fixProfiles(userMap);
await copyReports(branchMap, userMap);
await copyMonthly(branchMap, userMap);
await copyAudit(userMap);
await counts();
