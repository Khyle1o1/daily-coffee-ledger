-- Improve query performance for common WHERE/JOIN/ORDER BY paths.
-- Uses guarded DO blocks so migration remains safe across environments
-- where some columns may not exist yet.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'branches' AND column_name = 'is_active'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_branches_is_active_label
      ON public.branches (is_active, label);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_reports_daily_user_report_date
  ON public.reports_daily (user_id, report_date DESC);

CREATE INDEX IF NOT EXISTS idx_reports_daily_branch_report_date
  ON public.reports_daily (branch_id, report_date DESC);

CREATE INDEX IF NOT EXISTS idx_reports_monthly_user_month_key
  ON public.reports_monthly (user_id, month_key DESC);

CREATE INDEX IF NOT EXISTS idx_reports_monthly_branch_month_key
  ON public.reports_monthly (branch_id, month_key DESC);

CREATE INDEX IF NOT EXISTS idx_generated_reports_user_created_at
  ON public.generated_reports (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_action_module
  ON public.audit_logs (created_at DESC, action, module);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_created_at
  ON public.audit_logs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_manual_mappings_active_priority_created
  ON public.manual_mappings (is_active, priority DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_manual_mappings_norm_lookup
  ON public.manual_mappings (source_cat_norm, source_item_norm, source_opt_norm);

CREATE INDEX IF NOT EXISTS idx_directory_links_active_updated_at
  ON public.directory_links (is_active, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_directory_links_category_updated_at
  ON public.directory_links (category, updated_at DESC);
