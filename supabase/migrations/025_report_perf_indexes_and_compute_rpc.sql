-- 025: Report generate performance
-- - Drop unused GIN on full summary_json (write-heavy, 0 scans on Coolify)
-- - Drop expression GiST daterange index (lte/gte overlap query cannot use it)
-- - Add B-tree indexes matching date_range_start <= :to AND date_range_end >= :from
-- - Add reports_daily_compute_slim RPC: prune rowDetails by date + project compute keys

DROP INDEX IF EXISTS public.idx_reports_daily_summary_json;
DROP INDEX IF EXISTS public.idx_reports_monthly_summary_json;
DROP INDEX IF EXISTS public.idx_reports_daily_daterange_gist;

CREATE INDEX IF NOT EXISTS idx_reports_daily_range_end_start
  ON public.reports_daily (date_range_end, date_range_start);

CREATE INDEX IF NOT EXISTS idx_reports_daily_branch_range
  ON public.reports_daily (branch_id, date_range_end, date_range_start);

ANALYZE public.reports_daily;

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
        (r.summary_json - 'rowDetails' - 'unmappedSummary')
          || jsonb_build_object(
            'rowDetails', '[]'::jsonb,
            'unmappedSummary', '[]'::jsonb
          )
      ELSE
        (r.summary_json - 'rowDetails' - 'unmappedSummary')
          || jsonb_build_object(
            'unmappedSummary', '[]'::jsonb,
            'rowDetails', COALESCE((
              SELECT jsonb_agg(
                jsonb_strip_nulls(
                  jsonb_build_object(
                    'transactionDate', elem->'transactionDate',
                    'quantity', elem->'quantity',
                    'unitPrice', elem->'unitPrice',
                    'rowSales', elem->'rowSales',
                    'mappedCat', elem->'mappedCat',
                    'mappedItemName', elem->'mappedItemName',
                    'rawItemName', elem->'rawItemName',
                    'rawCategory', elem->'rawCategory',
                    'option', elem->'option',
                    'paymentType', elem->'paymentType',
                    'status', elem->'status',
                    'transactionId', elem->'transactionId',
                    'receiptNo', elem->'receiptNo',
                    'grossPrice', elem->'grossPrice',
                    'discountedPrice', elem->'discountedPrice',
                    'regularDiscount', elem->'regularDiscount',
                    'seniorDiscount', elem->'seniorDiscount',
                    'pwdDiscount', elem->'pwdDiscount',
                    'vatExemption', elem->'vatExemption'
                  )
                )
              )
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

GRANT EXECUTE ON FUNCTION public.reports_daily_compute_slim(date, date, uuid[], boolean)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.reports_daily_compute_slim(date, date, uuid[], boolean)
  TO service_role;

COMMENT ON FUNCTION public.reports_daily_compute_slim(date, date, uuid[], boolean) IS
  'Slim compute fetch: overlap filter + prune/project rowDetails for report generate.';

NOTIFY pgrst, 'reload schema';
