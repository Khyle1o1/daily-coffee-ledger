-- 020: GiST index for reports_daily date-range overlap queries
-- Supports fetchDailyReportsForCompute:
--   date_range_start <= :to AND date_range_end >= :from

CREATE INDEX IF NOT EXISTS idx_reports_daily_daterange_gist
  ON public.reports_daily
  USING GIST (daterange(date_range_start, date_range_end, '[]'));

NOTIFY pgrst, 'reload schema';
