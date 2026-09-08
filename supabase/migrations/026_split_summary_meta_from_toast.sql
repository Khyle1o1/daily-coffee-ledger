-- 026: Stop detoasting rowDetails on light reads.
--
-- reports_daily is 89 rows / 32 kB heap / 31 MB TOAST. Inside summary_json,
-- rowDetails is ~296 MB uncompressed while everything else is ~1.2 MB.
--
-- Any jsonb operator on summary_json forces a full detoast + parse + reserialize
-- of that 296 MB, even when the operator removes 712 bytes. Measured on the
-- Aug 2026 window (53 rows):
--
--   select summary_json                                    →    0.1 ms
--   select summary_json - 'unmappedSummary'                → 1404.4 ms
--   select summary_json - 'rowDetails' - 'unmappedSummary' →   85.7 ms
--
-- Fix: keep the light aggregates in their own column so light readers never
-- touch the rowDetails TOAST, and let the heavy reader return the column raw.

-- 1. Light metadata column, trigger-maintained ------------------------------

ALTER TABLE public.reports_daily
  ADD COLUMN IF NOT EXISTS summary_meta jsonb;

CREATE OR REPLACE FUNCTION public.reports_daily_sync_summary_meta()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.summary_meta :=
    COALESCE(NEW.summary_json, '{}'::jsonb) - 'rowDetails' - 'unmappedSummary';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reports_daily_summary_meta ON public.reports_daily;

CREATE TRIGGER reports_daily_summary_meta
BEFORE INSERT OR UPDATE OF summary_json ON public.reports_daily
FOR EACH ROW
EXECUTE FUNCTION public.reports_daily_sync_summary_meta();

-- Backfill without bumping updated_at: deriveDailyLedgerFromPos picks the
-- winning report for overlapping day ranges by updated_at.
ALTER TABLE public.reports_daily DISABLE TRIGGER update_reports_daily_updated_at;

UPDATE public.reports_daily
SET summary_meta = COALESCE(summary_json, '{}'::jsonb) - 'rowDetails' - 'unmappedSummary'
WHERE summary_meta IS NULL;

ALTER TABLE public.reports_daily ENABLE TRIGGER update_reports_daily_updated_at;

-- 2. List view reads the light column ---------------------------------------
-- Column names/order/types must match the existing view for CREATE OR REPLACE.
-- The COALESCE fallback only evaluates its second argument when summary_meta
-- is NULL, so populated rows never touch the TOAST.

CREATE OR REPLACE VIEW public.reports_daily_meta
WITH (security_invoker = on)
AS
SELECT
  r.id,
  r.branch_id,
  r.report_date,
  r.date_range_start,
  r.date_range_end,
  r.transactions_file_name,
  r.mapping_file_name,
  r.user_id,
  r.created_at,
  r.updated_at,
  COALESCE(
    r.summary_meta,
    r.summary_json - 'rowDetails' - 'unmappedSummary'
  ) AS summary_json
FROM public.reports_daily r;

GRANT SELECT ON public.reports_daily_meta TO authenticated;
GRANT SELECT ON public.reports_daily_meta TO anon;

-- 3. Compute RPC ------------------------------------------------------------
-- Aggregate-only  → read summary_meta, never touch rowDetails.
-- Fully contained → return summary_json untouched (no operator, no rebuild).
--                   unmappedSummary rides along; it is 712 bytes across the
--                   whole table and the browser drops it in
--                   slimSummaryJsonForCompute.
-- Partial overlap → still filters elements by date; work_mem is raised so the
--                   jsonb_agg does not spill to temp files.

CREATE OR REPLACE FUNCTION public.reports_daily_compute_slim(
  p_date_from date,
  p_date_to date,
  p_branch_ids uuid[] DEFAULT NULL,
  p_include_row_details boolean DEFAULT true
)
RETURNS TABLE (
  id uuid,
  branch_id uuid,
  report_date date,
  date_range_start date,
  date_range_end date,
  transactions_file_name text,
  mapping_file_name text,
  summary_json jsonb,
  user_id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  branch_name text,
  branch_label text
)
LANGUAGE sql
STABLE
PARALLEL SAFE
SECURITY INVOKER
SET search_path = public
SET work_mem = '64MB'
AS $$
  SELECT
    r.id,
    r.branch_id,
    r.report_date,
    r.date_range_start,
    r.date_range_end,
    r.transactions_file_name,
    r.mapping_file_name,
    CASE
      WHEN NOT COALESCE(p_include_row_details, true) THEN
        COALESCE(
          r.summary_meta,
          r.summary_json - 'rowDetails' - 'unmappedSummary'
        )
          || jsonb_build_object(
            'rowDetails', '[]'::jsonb,
            'unmappedSummary', '[]'::jsonb
          )
      -- Fully contained: hand back the stored value as-is.
      WHEN r.date_range_start >= p_date_from AND r.date_range_end <= p_date_to THEN
        r.summary_json
      ELSE
        COALESCE(
          r.summary_meta,
          r.summary_json - 'rowDetails' - 'unmappedSummary'
        )
          || jsonb_build_object(
            'unmappedSummary', '[]'::jsonb,
            'rowDetails', COALESCE((
              SELECT jsonb_agg(elem)
              FROM jsonb_array_elements(
                COALESCE(r.summary_json->'rowDetails', '[]'::jsonb)
              ) AS elem
              WHERE (
                CASE
                  WHEN jsonb_typeof(elem->'transactionDate') = 'string'
                    AND (elem->>'transactionDate') ~ '^\d{4}-\d{2}-\d{2}'
                    THEN left(elem->>'transactionDate', 10)::date
                  WHEN jsonb_typeof(elem->'transactionDate') = 'number'
                    THEN (
                      to_timestamp(
                        (elem->>'transactionDate')::double precision / 1000.0
                      )
                    )::date
                  ELSE NULL
                END
              ) BETWEEN p_date_from AND p_date_to
            ), '[]'::jsonb)
          )
    END AS summary_json,
    r.user_id,
    r.created_at,
    r.updated_at,
    b.name AS branch_name,
    b.label AS branch_label
  FROM public.reports_daily r
  LEFT JOIN public.branches b ON b.id = r.branch_id
  WHERE r.date_range_start <= p_date_to
    AND r.date_range_end >= p_date_from
    AND (
      p_branch_ids IS NULL
      OR cardinality(p_branch_ids) = 0
      OR r.branch_id = ANY (p_branch_ids)
    )
  ORDER BY r.date_range_start ASC, r.branch_id ASC;
$$;

-- 4. Drop indexes with zero scans and a redundant leading column ------------
-- RLS on reports_daily is `uid() IS NOT NULL`, so the user_id indexes serve
-- no policy. Each one is write overhead on a table whose upserts already
-- cost ~230 ms of TOAST churn.

DROP INDEX IF EXISTS public.idx_reports_daily_user_id;          -- 0 scans, unused by RLS
DROP INDEX IF EXISTS public.idx_reports_daily_user_report_date; -- 0 scans, unused by RLS
DROP INDEX IF EXISTS public.idx_reports_daily_date;             -- prefix of idx_reports_daily_date_branch
DROP INDEX IF EXISTS public.idx_reports_daily_branch;           -- prefix of idx_reports_daily_branch_range

ANALYZE public.reports_daily;

NOTIFY pgrst, 'reload schema';
