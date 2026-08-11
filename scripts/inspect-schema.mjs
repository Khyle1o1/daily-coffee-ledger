import { pgQuery } from './migrate-new-db.mjs';

const checks = await pgQuery(`
  SELECT c.conname, pg_get_constraintdef(c.oid) AS def
  FROM pg_constraint c
  WHERE c.conrelid = 'public.branches'::regclass AND c.contype = 'c'
`);
console.log('branch checks:', checks);

const cols = await pgQuery(`
  SELECT column_name, data_type
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='branches'
  ORDER BY ordinal_position
`);
console.log('branch cols:', cols);

const funcs = await pgQuery(`
  SELECT p.proname
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname='public'
  ORDER BY 1
`);
console.log('funcs:', funcs.map((f) => f.proname));

const policies = await pgQuery(`
  SELECT tablename, policyname
  FROM pg_policies
  WHERE schemaname='public'
  ORDER BY 1,2
`);
console.log('policy count:', policies.length);

const missingUserId = await pgQuery(`
  SELECT column_name FROM information_schema.columns
  WHERE table_schema='public' AND table_name='reports_daily' AND column_name='user_id'
`);
console.log('reports_daily.user_id:', missingUserId);

const profileCols = await pgQuery(`
  SELECT column_name FROM information_schema.columns
  WHERE table_schema='public' AND table_name='user_profiles'
  ORDER BY ordinal_position
`);
console.log('user_profiles:', profileCols.map((c) => c.column_name));
