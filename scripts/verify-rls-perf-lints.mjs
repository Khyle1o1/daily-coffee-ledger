import { pgQuery } from './migrate-new-db.mjs';

const initplan = await pgQuery(`
WITH policies AS (
  SELECT
    nsp.nspname AS schema_name,
    pb.tablename AS table_name,
    pa.polname AS policy_name,
    pb.qual,
    pb.with_check
  FROM pg_policy pa
  JOIN pg_class pc ON pa.polrelid = pc.oid
  JOIN pg_namespace nsp ON pc.relnamespace = nsp.oid
  JOIN pg_policies pb
    ON pc.relname = pb.tablename
   AND nsp.nspname = pb.schemaname
   AND pa.polname = pb.policyname
  WHERE nsp.nspname = 'public' AND pc.relrowsecurity
)
SELECT table_name, policy_name, qual, with_check
FROM policies
WHERE
  (
    (qual LIKE '%auth.uid()%' AND lower(qual) NOT LIKE '%select auth.uid()%')
    OR (qual LIKE '%auth.role()%' AND lower(qual) NOT LIKE '%select auth.role()%')
    OR (with_check LIKE '%auth.uid()%' AND lower(with_check) NOT LIKE '%select auth.uid()%')
    OR (with_check LIKE '%auth.role()%' AND lower(with_check) NOT LIKE '%select auth.role()%')
    OR (qual LIKE '%uid()%' AND lower(qual) NOT LIKE '%select %uid()%')
    OR (with_check LIKE '%uid()%' AND lower(with_check) NOT LIKE '%select %uid()%')
    OR (qual LIKE '%role()%' AND lower(qual) NOT LIKE '%select %role()%' AND qual NOT LIKE '%current_user_is_admin%')
    OR (with_check LIKE '%role()%' AND lower(with_check) NOT LIKE '%select %role()%')
  )
`);
console.log('initplan hits:', initplan);

const multi = await pgQuery(`
select
  c.relname,
  r.rolname,
  act.cmd,
  array_agg(p.polname order by p.polname) as policies
from pg_policy p
join pg_class c on p.polrelid = c.oid
join pg_namespace n on c.relnamespace = n.oid
join pg_roles r on p.polroles @> array[r.oid] or p.polroles = array[0::oid],
lateral (
  select x.cmd from unnest((
    select case p.polcmd
      when 'r' then array['SELECT']
      when 'a' then array['INSERT']
      when 'w' then array['UPDATE']
      when 'd' then array['DELETE']
      when '*' then array['SELECT','INSERT','UPDATE','DELETE']
      else array['ERROR']
    end
  )) x(cmd)
) act(cmd)
where c.relkind = 'r'
  and p.polpermissive
  and n.nspname = 'public'
  and r.rolname in ('anon', 'authenticated', 'authenticator')
group by c.relname, r.rolname, act.cmd
having count(1) > 1
order by 1,2,3
`);
console.log('multiple permissive:', multi);

const sample = await pgQuery(`
  SELECT tablename, policyname, roles, cmd, qual, with_check
  FROM pg_policies
  WHERE schemaname='public'
  ORDER BY 1,2
`);
console.log('policy count', sample.length);
console.log(sample.slice(0, 8));
