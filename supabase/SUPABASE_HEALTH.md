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
- Drops `unmappedSummary`
- Prunes `rowDetails` to the selected date window
- Projects only the ~18 compute fields (not the full ~362 KB/row blobs)
- `p_include_row_details = false` for Category Performance (uses `dailyBreakdown`)

On Coolify (CPU/TOAST-bound, ~128MB `shared_buffers`), migrations `025b`/`025c` keep
**date-pruning + drop `unmappedSummary`** in the RPC (with a fast path when the
report range is fully inside the window) and leave field projection to the
browser (`slimSummaryJsonForCompute`) — cheaper than rebuilding every jsonb
element on the VPS.

Measured on Coolify (Aug 2026 window, 41 reports):

| Path | Time | Payload |
|------|------|---------|
| Raw `reports_daily` select | ~70s | ~71 MB |
| Slim RPC (rowDetails) | ~20–40s | ~42 MB |
| Agg-only RPC (`p_include_row_details=false`) | ~0.5s | ~0.3 MB |

Fallback (RPC missing): month windows with concurrency 3, chunk size **25**,
client-side slim/prune. Caps: **40** rows per window, **150** unique across range,
~**48 MB** slimmed JSON.

Watch the browser console:

```
[fetchDailyReportsForComputeSlim] ✅ N rows in Xms …
[fetchDailyReportsForComputeRange] ✅ N reports via RPC in Xms — …
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

- `shared_buffers` / `effective_cache_size` default **128MB** — raise when the host has RAM
- `work_mem` default **4MB**

Interpretation:

- High CPU -> shrink JSON payloads (use the slim RPC); avoid GIN on full `summary_json`
- High connections -> fix pooling/reuse
- Slow generate with small row counts -> wire size / Kong latency, not index misses

## 8) Free Tier / Small VPS Notes

- Expect occasional cold starts and paused behavior on free hosted tiers
- On Coolify VPS, prefer the slim RPC path and avoid unbounded multi-month selects
- Upgrade CPU/RAM if generate remains CPU-bound after payload cuts
