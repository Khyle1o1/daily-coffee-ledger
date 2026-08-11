import { pgQuery } from './migrate-new-db.mjs';

const funcs = await pgQuery(`
  SELECT p.proname AS name, p.proconfig AS config
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
  ORDER BY 1
`);
console.log('functions:', funcs);

const alwaysTrue = await pgQuery(`
  SELECT tablename, policyname, cmd, qual, with_check
  FROM pg_policies
  WHERE schemaname = 'public'
    AND (
      replace(replace(lower(coalesce(qual,'')), ' ', ''), E'\\n', '') IN ('true','(true)')
      OR replace(replace(lower(coalesce(with_check,'')), ' ', ''), E'\\n', '') IN ('true','(true)')
    )
  ORDER BY 1,2
`);
console.log('remaining always-true policies:', alwaysTrue);

const branchPolicies = await pgQuery(`
  SELECT policyname, cmd, roles, qual, with_check
  FROM pg_policies
  WHERE schemaname='public' AND tablename='branches'
  ORDER BY 1
`);
console.log('branch policies:', branchPolicies);
