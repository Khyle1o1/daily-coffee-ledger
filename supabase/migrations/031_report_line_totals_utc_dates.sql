-- 031_report_line_totals_utc_dates.sql
--
-- HQ Sync is the source of truth for report calendar days.
-- Migration 030 switched rollup txn_date to Asia/Manila wall-clock dates so
-- Monthly matched HQ upward; product decision is the reverse: keep HQ Sync's
-- UTC-from-ISO calendar (left(iso,10)) and make Monthly Branch use the same
-- day bucketing via dailyBreakdown rebuilt from rowDetails.
--
-- Example: local midnight Aug 1 PH serializes as 2026-07-31T16:00:00.000Z →
-- txn_date 2026-07-31. August HQ / Monthly windows both exclude that day.

CREATE OR REPLACE FUNCTION public.report_txn_local_date(raw jsonb)
RETURNS date
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CASE
    WHEN raw IS NULL OR raw = 'null'::jsonb THEN NULL
    -- Date-only string: already a calendar day.
    WHEN jsonb_typeof(raw) = 'string'
      AND (raw #>> '{}') ~ '^\d{4}-\d{2}-\d{2}$'
      THEN (raw #>> '{}')::date
    -- ISO timestamptz string → UTC calendar date (same as left(iso, 10)).
    WHEN jsonb_typeof(raw) = 'string'
      AND (raw #>> '{}') ~ '^\d{4}-\d{2}-\d{2}'
      THEN left(raw #>> '{}', 10)::date
    -- Epoch milliseconds → UTC calendar date.
    WHEN jsonb_typeof(raw) = 'number'
      THEN (timezone('UTC', to_timestamp((raw #>> '{}')::double precision / 1000.0)))::date
    ELSE NULL
  END;
$$;

COMMENT ON FUNCTION public.report_txn_local_date(jsonb) IS
  'HQ Sync calendar date for rowDetails.transactionDate: UTC date from ISO (left 10), matching report_line_totals.';

NOTIFY pgrst, 'reload schema';

-- Rebuild rollups with:
--   node scripts/rebuild-report-line-totals.mjs
