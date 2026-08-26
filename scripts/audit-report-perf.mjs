/**
 * Read-only audit of reports_daily indexes, sizes, and overlap query plan.
 *
 * Self-hosted Coolify Supabase does not expose Postgres publicly.
 * Prefer Kong /pg/query via SUPABASE_URL + SERVICE_ROLE_KEY.
 * Falls back to DATABASE_URL when that works (local tunnel / direct).
 *
 * Usage: node scripts/audit-report-perf.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function loadEnv() {
  const text = fs.readFileSync(path.join(root, '.env'), 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (!m) continue;
    const key = m[1].trim();
    let val = m[2].trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

function encodeDatabaseUrl(raw) {
  if (!raw) return raw;
  const m = raw.match(/^(postgresql:\/\/[^:/]+:)([^@]+)(@.+)$/i);
  if (!m) return raw;
  return `${m[1]}${encodeURIComponent(decodeURIComponent(m[2]))}${m[3]}`;
}

function section(title) {
  console.log(`\n=== ${title} ===`);
}

loadEnv();

const supabaseUrl = (
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  ''
).replace(/\/$/, '');
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
  '';

/** @type {(sql: string, params?: unknown[]) => Promise<any[]>} */
let queryRows;

async function makePgQueryClient() {
  if (!supabaseUrl || !serviceKey) return null;
  try {
    const probe = await fetch(`${supabaseUrl}/pg/query`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: 'SELECT 1 AS ok' }),
    });
    if (!probe.ok) {
      console.log(`[pg/query] unavailable: HTTP ${probe.status}`);
      return null;
    }
    console.log(`Using Kong /pg/query at ${supabaseUrl}`);
    return async (sql) => {
      // /pg/query does not take bind params — inline carefully for audit only.
      const res = await fetch(`${supabaseUrl}/pg/query`, {
        method: 'POST',
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: sql }),
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
      // Some stacks return { rows: [...] }, others return the array directly.
      if (Array.isArray(json)) return json;
      if (Array.isArray(json?.rows)) return json.rows;
      if (Array.isArray(json?.data)) return json.data;
      return [json];
    };
  } catch (err) {
    console.log(`[pg/query] probe failed: ${err.message}`);
    return null;
  }
}

async function makeDirectClient() {
  const dbUrl = encodeDatabaseUrl(process.env.DATABASE_URL);
  if (!dbUrl) return null;
  const isLocal =
    /@127\.0\.0\.1:|@localhost:|@\[::1\]:/i.test(dbUrl) ||
    /sslmode=disable/i.test(dbUrl);
  const client = new pg.Client({
    connectionString: dbUrl,
    ssl: isLocal ? false : { rejectUnauthorized: false },
  });
  try {
    await client.connect();
    console.log('Using DATABASE_URL (direct Postgres)');
    return {
      query: async (sql, params) => {
        const { rows } = await client.query(sql, params);
        return rows;
      },
      end: () => client.end(),
    };
  } catch (err) {
    console.log(`[DATABASE_URL] unavailable: ${err.message}`);
    try {
      await client.end();
    } catch {
      /* ignore */
    }
    return null;
  }
}

const pgQueryFn = await makePgQueryClient();
const direct = pgQueryFn ? null : await makeDirectClient();

if (pgQueryFn) {
  queryRows = async (sql) => pgQueryFn(sql);
} else if (direct) {
  queryRows = async (sql, params) => direct.query(sql, params);
} else {
  console.error(
    'No DB access. Coolify Postgres is not public — set SUPABASE_URL + SERVICE_ROLE_KEY for /pg/query, or tunnel DATABASE_URL.',
  );
  process.exit(1);
}

try {
  section('Indexes on reports_daily / reports_monthly');
  const indexes = await queryRows(`
    SELECT tablename, indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename IN ('reports_daily', 'reports_monthly')
    ORDER BY tablename, indexname
  `);
  for (const r of indexes) {
    console.log(`${r.tablename}.${r.indexname}`);
    console.log(`  ${r.indexdef}`);
  }

  section('Index usage (pg_stat_user_indexes)');
  const usage = await queryRows(`
    SELECT relname, indexrelname, idx_scan, idx_tup_read, idx_tup_fetch,
           pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
    FROM pg_stat_user_indexes
    WHERE schemaname = 'public' AND relname IN ('reports_daily', 'reports_monthly')
    ORDER BY relname, idx_scan ASC, indexrelname
  `);
  for (const r of usage) {
    console.log(
      `${r.relname}.${r.indexrelname}: scans=${r.idx_scan} size=${r.index_size}`,
    );
  }

  section('summary_json column sizes');
  const sizes = await queryRows(`
    SELECT
      count(*) AS row_count,
      pg_size_pretty(avg(pg_column_size(summary_json))::bigint) AS avg_json,
      pg_size_pretty(max(pg_column_size(summary_json))::bigint) AS max_json,
      pg_size_pretty(sum(pg_column_size(summary_json))::bigint) AS sum_json,
      pg_size_pretty(pg_total_relation_size('public.reports_daily')) AS table_total
    FROM public.reports_daily
  `);
  console.log(sizes[0]);

  section('Server settings');
  for (const key of [
    'shared_buffers',
    'work_mem',
    'effective_cache_size',
    'statement_timeout',
    'max_connections',
  ]) {
    const rows = await queryRows(`SHOW ${key}`);
    console.log(`${key} = ${rows[0][key]}`);
  }

  section('EXPLAIN ANALYZE overlap filter (last 31 days)');
  const bounds = await queryRows(`
    SELECT
      coalesce(max(date_range_end), CURRENT_DATE)::text AS date_to,
      (coalesce(max(date_range_end), CURRENT_DATE) - interval '30 days')::date::text AS date_from
    FROM public.reports_daily
  `);
  const dateTo = bounds[0].date_to;
  const dateFrom = bounds[0].date_from;
  console.log(`Window: ${dateFrom} → ${dateTo}`);

  // Inline dates — audit-only, values come from our own SELECT above.
  const explain = await queryRows(`
    EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
    SELECT id, branch_id, report_date, date_range_start, date_range_end
    FROM public.reports_daily
    WHERE date_range_start <= '${dateTo}'::date
      AND date_range_end >= '${dateFrom}'::date
    ORDER BY date_range_start ASC, branch_id ASC
  `);
  for (const row of explain) {
    console.log(row['QUERY PLAN'] ?? JSON.stringify(row));
  }

  section('RPC exists?');
  const rpc = await queryRows(`
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'reports_daily_compute_slim'
  `);
  if (rpc.length === 0) {
    console.log('reports_daily_compute_slim: NOT FOUND');
  } else {
    for (const r of rpc) console.log(`${r.proname}(${r.args})`);
  }
} catch (err) {
  console.error('ERROR:', err.message);
  process.exitCode = 1;
} finally {
  if (direct) await direct.end();
}
