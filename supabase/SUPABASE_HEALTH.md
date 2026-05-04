# Supabase Health Hardening

## 1) Connection Pooling (Critical)

Use pooled Postgres in backend/serverless code:

`DATABASE_URL=postgresql://<user>:<password>@<project-ref>.pooler.supabase.com:6543/postgres`

Do not use direct host/port for application traffic:

- `...supabase.co:5432`

If you add a Node/Next/Laravel backend, reuse a singleton client instead of creating one per request.

## 2) Prevent Excessive Calls

- Debounce text-search/filter calls (300-400ms is a good baseline).
- Avoid polling unless the page truly needs near-real-time data.
- Avoid automatic re-fetch on every tab focus/reconnect unless required.
- Ensure data-loading effects run once on mount unless dependencies are intentional.

## 3) Query and Index Optimization

Run migration `supabase/migrations/015_performance_indexes.sql` to add targeted indexes for frequent `WHERE`, `JOIN`, and `ORDER BY` paths.

Also avoid `SELECT *` for list views where possible.

## 4) Find and Kill Long-Running Queries

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

## 5) Realtime Subscription Cleanup

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

## 6) Monitoring Checklist

Supabase Dashboard:

- Database -> Query Performance
- Reports -> CPU / RAM / Connections

Interpretation:

- High CPU -> optimize slow queries.
- High connections -> fix pooling/reuse.
- Slow query traces -> add/adjust indexes and avoid full scans.

## 7) Free Tier Notes

- Expect occasional cold starts and paused project behavior.
- Avoid heavy background jobs and aggressive polling.
- Upgrade if this system is production critical.
