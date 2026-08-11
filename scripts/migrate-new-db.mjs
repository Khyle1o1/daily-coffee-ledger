import fs from 'node:fs';

const base =
  'http://supabasekong-nr6zgff7wv4gilid4tf7grw8.187.52.114.150.sslip.io';
const serviceRoleKey =
  'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc4NjQzNzM2MCwiZXhwIjo0OTQyMTEwOTYwLCJyb2xlIjoic2VydmljZV9yb2xlIn0.iX66JlFTUL_yNMeLTwclCBFjD_g54zqnSfZ9kHtGbt8';

export async function pgQuery(query) {
  const res = await fetch(`${base}/pg/query`, {
    method: 'POST',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  if (!res.ok) {
    const msg =
      typeof json === 'string'
        ? json
        : json?.error || json?.message || JSON.stringify(json);
    throw new Error(`HTTP ${res.status}: ${msg}`);
  }
  return json;
}

/** Split SQL into statements, respecting $tag$ ... $tag$ and '...' strings. */
export function splitSql(sql) {
  const stmts = [];
  let buf = '';
  let i = 0;
  let inLineComment = false;
  let inBlockComment = false;
  let inSingle = false;
  let dollarTag = null;

  while (i < sql.length) {
    const ch = sql[i];
    const next = sql[i + 1];

    if (inLineComment) {
      buf += ch;
      if (ch === '\n') inLineComment = false;
      i += 1;
      continue;
    }

    if (inBlockComment) {
      buf += ch;
      if (ch === '*' && next === '/') {
        buf += next;
        i += 2;
        inBlockComment = false;
        continue;
      }
      i += 1;
      continue;
    }

    if (dollarTag !== null) {
      buf += ch;
      if (ch === '$') {
        const maybe = sql.slice(i, i + dollarTag.length);
        if (maybe === dollarTag) {
          buf += sql.slice(i + 1, i + dollarTag.length);
          i += dollarTag.length;
          dollarTag = null;
          continue;
        }
      }
      i += 1;
      continue;
    }

    if (inSingle) {
      buf += ch;
      if (ch === "'" && next === "'") {
        buf += next;
        i += 2;
        continue;
      }
      if (ch === "'") inSingle = false;
      i += 1;
      continue;
    }

    if (ch === '-' && next === '-') {
      buf += ch + next;
      i += 2;
      inLineComment = true;
      continue;
    }
    if (ch === '/' && next === '*') {
      buf += ch + next;
      i += 2;
      inBlockComment = true;
      continue;
    }

    if (ch === "'") {
      buf += ch;
      inSingle = true;
      i += 1;
      continue;
    }

    if (ch === '$') {
      const m = sql.slice(i).match(/^\$[A-Za-z0-9_]*\$/);
      if (m) {
        dollarTag = m[0];
        buf += dollarTag;
        i += dollarTag.length;
        continue;
      }
    }

    if (ch === ';') {
      const stmt = buf.trim();
      if (stmt) stmts.push(stmt);
      buf = '';
      i += 1;
      continue;
    }

    buf += ch;
    i += 1;
  }

  const tail = buf.trim();
  if (tail) stmts.push(tail);
  return stmts;
}

function stripBom(s) {
  return s.replace(/^\uFEFF/, '');
}

async function resetPublic() {
  console.log('Dropping public objects...');
  await pgQuery(`
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT viewname FROM pg_views WHERE schemaname = 'public'
  ) LOOP
    EXECUTE format('DROP VIEW IF EXISTS public.%I CASCADE', r.viewname);
  END LOOP;

  FOR r IN (
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  ) LOOP
    EXECUTE format('DROP TABLE IF EXISTS public.%I CASCADE', r.tablename);
  END LOOP;

  FOR r IN (
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
  ) LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS %s CASCADE', r.sig);
  END LOOP;
END $$;
`);
}

async function applyFile(path) {
  let sql = stripBom(fs.readFileSync(path, 'utf8'));
  sql = sql.replace(/\r\n/g, '\n');

  const stmts = splitSql(sql);
  console.log(`Applying ${path}: ${stmts.length} statements`);

  let ok = 0;
  let fail = 0;

  for (const [idx, stmt] of stmts.entries()) {
    const meaningful = stmt
      .replace(/--.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .trim();
    if (!meaningful) continue;

    try {
      await pgQuery(stmt);
      ok += 1;
    } catch (e) {
      fail += 1;
      const head = stmt.slice(0, 140).replace(/\s+/g, ' ');
      console.error(`FAIL #${idx}: ${e.message.slice(0, 250)}`);
      console.error(`  ${head}`);
    }
  }

  console.log(`ok=${ok} fail=${fail}`);
  return { ok, fail };
}

const isMain = process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('migrate-new-db.mjs');

if (isMain) {
  const mode = process.argv[2] || 'apply';

  if (mode === 'reset') {
    await resetPublic();
    console.log(
      await pgQuery(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema='public' ORDER BY 1
    `),
    );
  } else if (mode === 'apply') {
    const path = process.argv[3] || 'supabase/migrations/FULL_SCHEMA.sql';
    if (process.argv.includes('--reset')) {
      await resetPublic();
    }
    const result = await applyFile(path);

    console.log(
      'tables:',
      await pgQuery(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema='public' ORDER BY 1
    `),
    );
    console.log(
      'functions:',
      (
        await pgQuery(`
      SELECT p.proname
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname='public'
      ORDER BY 1
    `)
      ).map((f) => f.proname),
    );
    console.log(
      'branches:',
      await pgQuery(`SELECT count(*)::int AS c FROM public.branches`),
    );
    console.log(
      'current_user_is_admin exists:',
      await pgQuery(`
      SELECT EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname='public' AND p.proname='current_user_is_admin'
      ) AS ok
    `),
    );
    if (result.fail > 0) process.exitCode = 1;
  } else if (mode === 'inspect') {
    console.log(
      await pgQuery(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema='public' ORDER BY 1
    `),
    );
  } else {
    throw new Error(`Unknown mode ${mode}`);
  }
}
