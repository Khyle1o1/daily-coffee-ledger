-- Support the paginated listAllDailyReports query which orders by
--   report_date DESC, branch_id ASC
-- and can optionally filter on branch_id, report_date range.
--
-- The existing idx_reports_daily_branch_report_date (branch_id, report_date DESC)
-- is used when a branchId filter is applied.  This new index covers the
-- full-table sort used by the unfiltered list and by date-range-only queries.

CREATE INDEX IF NOT EXISTS idx_reports_daily_date_branch
  ON public.reports_daily (report_date DESC, branch_id ASC);
