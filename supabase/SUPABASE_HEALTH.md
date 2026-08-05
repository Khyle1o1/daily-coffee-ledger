# Supabase Health Hardening

## 1) Connection Pooling (Critical)

Use pooled Postgres in backend/serverless/scripts:

`DATABASE_URL=postgresql://<user>:<password>@<project-ref>.pooler.supabase.com:6543/postgres`

Do not use direct host/port for application traffic:

- `...supabase.co:5432`

Encode special characters in the DB password (`#`, `@`, etc.) as URL percent-encoding (e.g. `#` → `%23`).

The SPA talks to Supabase via PostgREST (anon/service keys), not `DATABASE_URL`. Scripts that run SQL (migrations) use the pooled URL.

If you add a Node/Next/Laravel backend, reuse a singleton client instead of creating one per request.

## 2) Prevent Excessive Calls

- Debounce text-search/filter calls (300-400ms is a good baseline).
- Avoid polling unless the page truly needs near-real-time data.
- Avoid automatic re-fetch on every tab focus/reconnect unless required.
- Ensure data-loading effects run once on mount unless dependencies are intentional.
- Daily list uses `staleTime: 60s` and does **not** force `refetchOnMount: "always"`.
- React Query persist only stores light keys (daily list, branches, directory) — never compute/detail blobs (`buster: v4-health-light-cache`).

## 3) Report generate payload caps (Critical)

`fetchDailyReportsForCompute` loads full `summary_json` (including `rowDetails`). That is the main overload path.

App safeguards:

- Date-range **overlap** fetch (so dual-month uploads still work), chunked (8 reports/request).
- Hard cap: max **40** overlapping report rows per generate.
- Hard cap: ~**15 MB** aggregate JSON payload.
- UI blocks ranges **> 62 days**, and **all-branches** generates longer than **31 days**.

Watch the browser console:

```
[fetchDailyReportsForCompute] chunk 0-7: …
[fetchDailyReportsForCompute] ✅ N rows in Xms (~Y KB)
```

If you hit the cap, narrow the date range or select fewer branches.

## 4) Query and Index Optimization

Run migrations:

- `015_performance_indexes.sql` — frequent WHERE / JOIN / ORDER BY
- `017_reports_daily_list_index.sql` — list sort
- `020_reports_daily_overlap_index.sql` — GiST on `daterange(date_range_start, date_range_end)` for compute overlap

Prefer `reports_daily_meta` for list UIs (strips `rowDetails` / `unmappedSummary` on the wire). Avoid `SELECT *` on list endpoints.

## 5) Find and Kill Long-Running Queries

Run in Supabase SQL Editor:

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

Supabase Dashboard:

- Database -> Query Performance
- Reports -> CPU / RAM / Connections

Interpretation:

- High CPU -> optimize slow queries / shrink JSON payloads.
- High connections -> fix pooling/reuse.
- Slow query traces -> add/adjust indexes and avoid full scans.

## 8) Free Tier Notes

- Expect occasional cold starts and paused project behavior.
- Avoid heavy background jobs and aggressive polling.
- Upgrade if this system is production critical.
