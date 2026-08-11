import { pgQuery } from './migrate-new-db.mjs';

const rows = await pgQuery(`
  SELECT tablename, policyname, qual, with_check
  FROM pg_policies
  WHERE schemaname = 'public'
  ORDER BY 1, 2
`);
for (const r of rows) {
  const hit =
    /auth\.(uid|role|jwt|email)\(\)/i.test(r.qual || '') ||
    /auth\.(uid|role|jwt|email)\(\)/i.test(r.with_check || '') ||
    /\buid\(\)/i.test(r.qual || '') ||
    /\buid\(\)/i.test(r.with_check || '') ||
    /\brole\(\)/i.test(r.qual || '') ||
    /\brole\(\)/i.test(r.with_check || '');
  if (hit) console.log(r);
}
