import { pgQuery } from './migrate-new-db.mjs';

await pgQuery(`ALTER VIEW public.reports_daily_meta SET (security_invoker = on)`);
await pgQuery(`NOTIFY pgrst, 'reload schema'`);

const rows = await pgQuery(`
  SELECT c.relname AS view_name,
         COALESCE(
           (SELECT option_value
            FROM pg_options_to_table(c.reloptions)
            WHERE option_name = 'security_invoker'),
           'off'
         ) AS security_invoker
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'v'
    AND c.relname = 'reports_daily_meta'
`);
console.log(rows);
