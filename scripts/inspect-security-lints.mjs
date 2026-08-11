import { pgQuery } from './migrate-new-db.mjs';

const funcs = await pgQuery(`
  SELECT
    n.nspname AS schema,
    p.proname AS name,
    pg_get_function_identity_arguments(p.oid) AS args,
    p.prosecdef AS security_definer,
    p.proconfig AS config
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
  ORDER BY p.proname
`);
console.log('=== public functions ===');
for (const f of funcs) {
  const cfg = f.config || [];
  const hasSearchPath = cfg.some?.((c) => String(c).startsWith('search_path='))
    || (Array.isArray(cfg) && cfg.some((c) => String(c).startsWith('search_path=')));
  console.log({
    name: f.name,
    args: f.args,
    security_definer: f.security_definer,
    config: f.config,
    has_search_path: hasSearchPath,
  });
}

const policies = await pgQuery(`
  SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
  FROM pg_policies
  WHERE schemaname = 'public'
  ORDER BY tablename, policyname
`);
console.log('\n=== policies ===');
console.log(JSON.stringify(policies, null, 2));

const rls = await pgQuery(`
  SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r'
  ORDER BY 1
`);
console.log('\n=== rls flags ===');
console.log(rls);
