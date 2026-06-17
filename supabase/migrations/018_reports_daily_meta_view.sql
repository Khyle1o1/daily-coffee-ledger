CREATE OR REPLACE VIEW public.reports_daily_meta AS
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
  (r.summary_json - 'rowDetails' - 'unmappedSummary') AS summary_json
FROM public.reports_daily r;

GRANT SELECT ON public.reports_daily_meta TO authenticated;
GRANT SELECT ON public.reports_daily_meta TO anon;
