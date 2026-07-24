-- 019: Fix user_profiles RLS infinite recursion + missing reports_daily_meta
-- Policies that subquery user_profiles from within user_profiles policies recurse.
-- Use SECURITY DEFINER helpers (bypass RLS) instead.

CREATE OR REPLACE FUNCTION public.is_admin(user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE user_id = user_uuid
      AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin(auth.uid());
$$;

-- Recreate user_profiles policies without self-referencing subqueries
DROP POLICY IF EXISTS "user_profiles_admin_read" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_admin_insert" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_admin_update" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_admin_delete" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_self_read" ON public.user_profiles;

CREATE POLICY "user_profiles_self_read"
  ON public.user_profiles
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "user_profiles_admin_read"
  ON public.user_profiles
  FOR SELECT
  USING (public.current_user_is_admin());

CREATE POLICY "user_profiles_admin_insert"
  ON public.user_profiles
  FOR INSERT
  WITH CHECK (public.current_user_is_admin());

CREATE POLICY "user_profiles_admin_update"
  ON public.user_profiles
  FOR UPDATE
  USING (public.current_user_is_admin());

CREATE POLICY "user_profiles_admin_delete"
  ON public.user_profiles
  FOR DELETE
  USING (public.current_user_is_admin());

-- audit_logs admin select used the same recursive pattern
DROP POLICY IF EXISTS "audit_logs_select_admin" ON public.audit_logs;
CREATE POLICY "audit_logs_select_admin"
  ON public.audit_logs
  FOR SELECT
  USING (public.current_user_is_admin());

-- manual_mappings admin policies used the same recursive pattern
DO $$
BEGIN
  IF to_regclass('public.manual_mappings') IS NOT NULL THEN
    DROP POLICY IF EXISTS "manual_mappings_admin_all" ON public.manual_mappings;
    CREATE POLICY "manual_mappings_admin_all"
      ON public.manual_mappings
      FOR ALL
      TO authenticated
      USING (public.current_user_is_admin())
      WITH CHECK (public.current_user_is_admin());
  END IF;
END $$;

-- Missing from FULL_SCHEMA: list view used by listAllDailyReports
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

-- Force PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
