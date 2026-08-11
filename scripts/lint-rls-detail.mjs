import { pgQuery } from './migrate-new-db.mjs';

const exprs = await pgQuery(`
  SELECT
    n.nspname AS schema_name,
    c.relname AS table_name,
    p.polname AS policy_name,
    CASE p.polcmd
      WHEN 'r' THEN 'SELECT'
      WHEN 'a' THEN 'INSERT'
      WHEN 'w' THEN 'UPDATE'
      WHEN 'd' THEN 'DELETE'
      WHEN '*' THEN 'ALL'
    END AS command,
    pg_get_expr(p.polqual, p.polrelid) AS using_expr,
    pg_get_expr(p.polwithcheck, p.polrelid) AS check_expr,
    (SELECT array_agg(r.rolname ORDER BY r.rolname)
     FROM pg_roles r
     WHERE p.polroles @> ARRAY[r.oid] OR p.polroles = ARRAY[0::oid]) AS roles
  FROM pg_policy p
  JOIN pg_class c ON c.oid = p.polrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
  ORDER BY 2, 3
`);
console.log(JSON.stringify(exprs, null, 2));

const multi = await pgQuery(`
select
  n.nspname,
  c.relname,
  r.rolname,
  act.cmd,
  array_agg(p.polname order by p.polname) as policies
from
  pg_catalog.pg_policy p
  join pg_catalog.pg_class c on p.polrelid = c.oid
  join pg_catalog.pg_namespace n on c.relnamespace = n.oid
  join pg_catalog.pg_roles r
    on p.polroles @> array[r.oid] or p.polroles = array[0::oid],
  lateral (
    select x.cmd
    from unnest((
      select case p.polcmd
        when 'r' then array['SELECT']
        when 'a' then array['INSERT']
        when 'w' then array['UPDATE']
        when 'd' then array['DELETE']
        when '*' then array['SELECT', 'INSERT', 'UPDATE', 'DELETE']
        else array['ERROR']
      end
    )) x(cmd)
  ) act(cmd)
where
  c.relkind = 'r'
  and p.polpermissive
  and n.nspname = 'public'
  and r.rolname not like 'pg_%'
  and r.rolname not like 'supabase%admin'
  and not r.rolbypassrls
group by n.nspname, c.relname, r.rolname, act.cmd
having count(1) > 1
order by 1,2,3,4
`);
console.log('\\nmultiple permissive:', JSON.stringify(multi, null, 2));
