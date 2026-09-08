# Supabase Health Hardening

## 1) Connection Pooling (Critical)

Use pooled Postgres in backend/serverless/scripts when a direct URL is available.

Coolify / Hostinger self-hosted stacks usually **do not expose Postgres publicly**.
In that case:

- App traffic goes through Kong → PostgREST (`SUPABASE_URL` + anon/service keys)
- SQL migrations / audits use Kong **`/pg/query`** via `scripts/apply-migration-pg-query.mjs`
  and `scripts/audit-report-perf.mjs` (not `DATABASE_URL` on localhost)

Encode special characters in any DB password (`#`, `@`, etc.) as URL percent-encoding (e.g. `#` → `%23`).

If you add a Node/Next/Laravel backend, reuse a singleton client instead of creating one per request.

## 2) Prevent Excessive Calls

- Debounce text-search/filter calls (300-400ms is a good baseline).
- Avoid polling unless the page truly needs near-real-time data.
- Avoid automatic re-fetch on every tab focus/reconnect unless required.
- Ensure data-loading effects run once on mount unless dependencies are intentional.
- Daily list uses `staleTime: 60s` and does **not** force `refetchOnMount: "always"`.
- React Query persist only stores light keys (daily list, branches, directory) — never compute/detail blobs (`buster: v4-health-light-cache`).

## 3) Report generate payload (Critical)

Generate prefers the **`reports_daily_compute_slim`** RPC (migration `025`):

- Overlap filter on `date_range_start` / `date_range_end`
- Prunes `rowDetails` to the selected date window
- `p_include_row_details = false` for Category Performance (uses `dailyBreakdown`)

On Coolify (CPU/TOAST-bound, ~128MB `shared_buffers`), migrations `025b`/`025c` keep
date-pruning in the RPC and leave field projection to the browser
(`slimSummaryJsonForCompute`) — cheaper than rebuilding every jsonb element on
the VPS.

### Never apply a jsonb operator to `summary_json` on a light read

`reports_daily` is ~89 rows / **32 kB heap / 31 MB TOAST**. Inside `summary_json`,
`rowDetails` is ~296 MB uncompressed; every other key totals ~1.2 MB.

Any jsonb operator (`-`, `||`, `->`) forces a full detoast + parse + reserialize
of that 296 MB — even when the operator strips 712 bytes. Measured on the
Aug 2026 window (53 rows):

| Expression | Time |
|------------|------|
| `select summary_json` (raw column) | **0.1 ms** |
| `select summary_json - 'unmappedSummary'` | **1404 ms** |
| `select summary_json - 'rowDetails' - 'unmappedSummary'` | **86 ms** |

Migration `026` fixes this:

- `reports_daily.summary_meta` holds the light aggregates (~14 kB/row),
  maintained by the `reports_daily_summary_meta` BEFORE INSERT/UPDATE trigger
- `reports_daily_meta` view selects `summary_meta`, so the list never touches TOAST
- `reports_daily_compute_slim` returns `summary_json` **untouched** on the
  fully-contained fastpath, and `summary_meta` when `p_include_row_details = false`

Backfills that rewrite `summary_json` must run with
`update_reports_daily_updated_at` disabled — `deriveDailyLedgerFromPos` breaks
ties between overlapping report ranges on `updated_at`.

Measured on Coolify (Aug 2026 window, 53 reports), server-side:

| Path | Before 026 | After 026 |
|------|-----------|-----------|
| `reports_daily_meta` list page | 177 ms | **0.35 ms** |
| Agg-only RPC (`p_include_row_details=false`) | 101 ms | **7.5 ms** |
| Slim RPC with `rowDetails` | 3515 ms (173 MB temp spill) | **1054 ms**, no spill |

### Kong gzip (enabled)

After migration `026` generate became **wire-bound, not database-bound**: the DB
finished in ~1s but the 51 MB response took ~25s to cross Kong uncompressed.

These are set on the Coolify Kong service:

```
KONG_NGINX_HTTP_GZIP=on
KONG_NGINX_HTTP_GZIP_COMP_LEVEL=5
KONG_NGINX_HTTP_GZIP_MIN_LENGTH=1024
KONG_NGINX_HTTP_GZIP_PROXIED=any
KONG_NGINX_HTTP_GZIP_TYPES=application/json application/javascript text/plain text/css
```

| Aug 2026 generate | Uncompressed | gzip |
|---|---|---|
| Wire size | 51.46 MB | **2.78 MB (18.5x)** |
| Time | 25.6 s | **2.8 s** |

Browsers always send `Accept-Encoding`, so the app gets this automatically.
Verify after any Kong redeploy:

```
curl -s -H "Accept-Encoding: gzip" -o /dev/null -D - \
  -X POST "$SUPABASE_URL/rest/v1/rpc/reports_daily_compute_slim" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"p_date_from":"2026-08-01","p_date_to":"2026-08-31","p_branch_ids":null,"p_include_row_details":true}' \
  | grep -i content-encoding
```

### The 8s statement timeout sets the request size

PostgREST connects as `authenticator`, which carries `statement_timeout=8s`
(`anon` is 3s). `SET ROLE service_role` does **not** lift it — the session
setting already applies, so every PostgREST call is capped at 8s regardless of
role. Setting `statement_timeout` inside the RPC does not help either; the
timer is armed when the statement starts.

One month of `rowDetails` runs 2–6s, so a single request must stay at or below
one calendar month. `fetchDailyReportsForComputeRange` therefore skips the
whole-range attempt when the span exceeds `MAX_SINGLE_REQUEST_SPAN_DAYS` (31)
and splits into month windows immediately, instead of burning the full 8s first.
Aggregate-only fetches read `summary_meta` and are exempt.

Full-year generate via month windows, all 8 populated windows succeeded:

| Window | Time | Reports | Lines |
|---|---|---|---|
| 2026-01 | 2122 ms | 8 | 68,682 |
| 2026-03 | 5823 ms | 7 | 66,968 |
| 2026-07 | 4780 ms | 22 | 157,493 |
| 2026-08 | 3454 ms | 53 | 131,738 |
| **total** | **25.0 s** | **119** | **664,540** |

March at 5.8s is the closest to the 8s ceiling. If a single month starts timing
out, the existing deeper fallback (table chunks → branch batches) takes over;
raising `authenticated` / `authenticator` `statement_timeout` is the other lever.

Fallback (RPC missing or over the per-request cap): month windows + **branch
batches** (3 branches per request), concurrency 3. Caps: **40** rows per
request, **150** unique reports, **96 MB** per HTTP call, **384 MB** merged in
the browser.

### Why the per-request cap moved from 48 MB to 96 MB

The 48 MB figure predates Kong gzip. Two 2026 windows exceeded it — July at
55.9 MB — which pushed them onto the table fallback, and that path reads raw
`summary_json` **without** the RPC's date pruning, so it is both slower and
larger. Post-gzip, 96 MB of JSON is ~5 MB on the wire, so the cap was raised.
Full-year generate over all 23 branches went **17.8 s → 11.8 s** with no window
over the cap.

### Year-scale headroom — `report_line_totals` (migration 028)

ReportsPage generate no longer downloads raw POS lines. Every report on that
page is a sum of qty/sales by category, item and channel, so a trigger-maintained
rollup (`report_line_totals`) stores that grain and `reports_daily_rollup`
returns it. The browser still sees `DailyReport.rowDetails`, but each "line" is
already aggregated.

Do **not** aggregate at query time with `jsonb_array_elements(summary_json)` —
that is the 026 detoast trap. Rebuild runs per report on write only.

Measured through PostgREST with gzip, full year 2026, all 23 branches:

| Path | JSON | Wire | Time | Lines |
|---|---|---|---|---|
| Old (raw `rowDetails`, 12 month windows) | 158.1 MB | ~8 MB | 11.8 s | 445,191 |
| New (`reports_daily_rollup` + meta) | **10.8 MB** | **0.93 MB** | **1.4 s** | 147,711 |

A single year-wide rollup RPC also fits the 8s authenticator timeout (1.07 s /
9.93 MB). The client still splits spans >31 days into month windows as a
ceiling. Daily Cash Ledger still fetches raw `rowDetails` because it needs
discount columns the rollup RPC does not return.

These paths used to narrate themselves in the browser console. That logging was
removed — it leaked user ids, emails and roles — and production builds now drop
`console.*` entirely via `esbuild.drop` in `vite.config.ts`, with `no-console`
enforced by ESLint.

To observe a generate now, use the browser Network tab: each
`rpc/reports_daily_rollup` call is one month window, plus one
`rpc/reports_daily_compute_slim` with `p_include_row_details=false` for
metadata. For server-side timing, query `pg_stat_statements` (§3).

### Current end-to-end timings

Measured through PostgREST with gzip on, Aug 2026, 53 reports / 131,738 lines:

| Path | Time | Wire |
|---|---|---|
| Daily list (50 rows) | 325 ms | 0.18 MB |
| Category Performance (agg only) | 140 ms | 0.30 MB |
| Generate, one month | 2.6 s | 2.78 MB gzipped |
| Generate, full year (8 windows) | ~25 s | — |

Reset the baseline after each optimisation so stale one-off queries stop
dominating the report:

```sql
select pg_stat_statements_reset();
```

Bench wire size:

```
node scripts/bench-compute-fetch.mjs 2026-08-01 2026-08-25
```

## 4) Query and Index Optimization

Run / verify:

- `015_performance_indexes.sql` — frequent WHERE / JOIN / ORDER BY
- `017_reports_daily_list_index.sql` — list sort
- `025_report_perf_indexes_and_compute_rpc.sql` — drops unused GIN on full `summary_json`
  and the unused expression GiST; adds `(date_range_end, date_range_start)` and
  `(branch_id, date_range_end, date_range_start)`; adds `reports_daily_compute_slim`
- `026_split_summary_meta_from_toast.sql` — `summary_meta` column + trigger;
  drops four indexes with zero scans (`user_id`, `user_report_date` — RLS here is
  only `uid() IS NOT NULL`, so neither serves a policy — plus `report_date` and
  `branch_id`, which are prefixes of existing composites)

**On a table this size, indexes are not the lever.** 89 rows in a 32 kB heap
always seq scan; `index_advisor` returns null for every slow statement. Cost
lives in TOAST detoasting and wire size.

Audit live Coolify DB:

```
node scripts/audit-report-perf.mjs
```

Prefer `reports_daily_meta` for list UIs (strips `rowDetails` / `unmappedSummary` on the wire).

## 5) Find and Kill Long-Running Queries

Run in Supabase SQL Editor (or `/pg/query`):

```sql
select pid, now() - query_start as duration, query, state
from pg_stat_activity
where state != 'idle'
order by duration desc;
```

Terminate stuck sessions:

```sql
select pg_terminate_backend(pid)
from pg_stat_activity
where state != 'idle'
and now() - query_start > interval '5 minutes';
```

## 6) Realtime Subscription Cleanup

Always return cleanup in React effects:

```ts
useEffect(() => {
  const channel = supabase
    .channel("realtime")
    .on("postgres_changes", { event: "*", schema: "public" }, handler)
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, []);
```

## 7) Monitoring Checklist

Coolify / Hostinger:

- Service CPU / RAM for `supabase-db` and `supabase-rest`
- Kong proxy read timeouts on large generate responses

Postgres defaults on small VPS are often too low for JSONB TOAST:

- `shared_buffers` **128MB** — needs a Postgres restart; set outside the DB
- `effective_cache_size` was 128MB, `random_page_cost` was 4 — both corrected in
  migration `027` via `ALTER DATABASE` (planner estimates only, no allocation)
- `work_mem` **4MB** globally; `reports_daily_compute_slim` sets `work_mem = '64MB'`
  locally so the partial-overlap `jsonb_agg` stops spilling to temp files

Interpretation:

- High CPU -> shrink JSON payloads (use the slim RPC); avoid GIN on full `summary_json`
- High connections -> fix pooling/reuse
- Slow generate with small row counts -> wire size / Kong latency, not index misses

## 8) Free Tier / Small VPS Notes

- Expect occasional cold starts and paused behavior on free hosted tiers
- On Coolify VPS, prefer the slim RPC path and avoid unbounded multi-month selects
- Upgrade CPU/RAM if generate remains CPU-bound after payload cuts
