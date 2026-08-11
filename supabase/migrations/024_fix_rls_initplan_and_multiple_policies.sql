-- 024: Fix auth_rls_initplan + multiple_permissive_policies
-- - Wrap auth.uid()/auth.role() in (select ...) for InitPlan caching
-- - Scope policies TO authenticated (avoid public-role fanout)
-- - One permissive policy per role+action

-- ═══════════════════════════════════════════════════════════════════════════
-- audit_logs
-- ═══════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "audit_logs_insert_authenticated" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_select_admin" ON public.audit_logs;

CREATE POLICY "audit_logs_insert_authenticated"
  ON public.audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

CREATE POLICY "audit_logs_select_admin"
  ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING ((SELECT public.current_user_is_admin()));

-- ═══════════════════════════════════════════════════════════════════════════
-- branches
-- ═══════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "branches_auth_read" ON public.branches;
DROP POLICY IF EXISTS "branches_admin_insert" ON public.branches;
DROP POLICY IF EXISTS "branches_admin_update" ON public.branches;
DROP POLICY IF EXISTS "branches_admin_delete" ON public.branches;

CREATE POLICY "branches_auth_read"
  ON public.branches
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

CREATE POLICY "branches_admin_insert"
  ON public.branches
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT public.current_user_is_admin()));

CREATE POLICY "branches_admin_update"
  ON public.branches
  FOR UPDATE
  TO authenticated
  USING ((SELECT public.current_user_is_admin()))
  WITH CHECK ((SELECT public.current_user_is_admin()));

CREATE POLICY "branches_admin_delete"
  ON public.branches
  FOR DELETE
  TO authenticated
  USING ((SELECT public.current_user_is_admin()));

-- ═══════════════════════════════════════════════════════════════════════════
-- directory_links
-- ═══════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "directory_links_auth_read" ON public.directory_links;
DROP POLICY IF EXISTS "directory_links_admin_insert" ON public.directory_links;
DROP POLICY IF EXISTS "directory_links_admin_update" ON public.directory_links;
DROP POLICY IF EXISTS "directory_links_admin_delete" ON public.directory_links;

CREATE POLICY "directory_links_auth_read"
  ON public.directory_links
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

CREATE POLICY "directory_links_admin_insert"
  ON public.directory_links
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT public.current_user_is_admin()));

CREATE POLICY "directory_links_admin_update"
  ON public.directory_links
  FOR UPDATE
  TO authenticated
  USING ((SELECT public.current_user_is_admin()))
  WITH CHECK ((SELECT public.current_user_is_admin()));

CREATE POLICY "directory_links_admin_delete"
  ON public.directory_links
  FOR DELETE
  TO authenticated
  USING ((SELECT public.current_user_is_admin()));

-- ═══════════════════════════════════════════════════════════════════════════
-- reports_daily (shared pool for all authenticated users)
-- ═══════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "reports_daily_shared_read" ON public.reports_daily;
DROP POLICY IF EXISTS "reports_daily_shared_insert" ON public.reports_daily;
DROP POLICY IF EXISTS "reports_daily_shared_update" ON public.reports_daily;
DROP POLICY IF EXISTS "reports_daily_shared_delete" ON public.reports_daily;
DROP POLICY IF EXISTS "reports_daily_public_read" ON public.reports_daily;
DROP POLICY IF EXISTS "reports_daily_public_insert" ON public.reports_daily;
DROP POLICY IF EXISTS "reports_daily_public_update" ON public.reports_daily;
DROP POLICY IF EXISTS "reports_daily_public_delete" ON public.reports_daily;

CREATE POLICY "reports_daily_auth_read"
  ON public.reports_daily
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

CREATE POLICY "reports_daily_auth_insert"
  ON public.reports_daily
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

CREATE POLICY "reports_daily_auth_update"
  ON public.reports_daily
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL)
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

CREATE POLICY "reports_daily_auth_delete"
  ON public.reports_daily
  FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

-- ═══════════════════════════════════════════════════════════════════════════
-- reports_monthly
-- ═══════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "reports_monthly_shared_read" ON public.reports_monthly;
DROP POLICY IF EXISTS "reports_monthly_shared_insert" ON public.reports_monthly;
DROP POLICY IF EXISTS "reports_monthly_shared_update" ON public.reports_monthly;
DROP POLICY IF EXISTS "reports_monthly_shared_delete" ON public.reports_monthly;
DROP POLICY IF EXISTS "reports_monthly_public_read" ON public.reports_monthly;
DROP POLICY IF EXISTS "reports_monthly_public_insert" ON public.reports_monthly;
DROP POLICY IF EXISTS "reports_monthly_public_update" ON public.reports_monthly;
DROP POLICY IF EXISTS "reports_monthly_public_delete" ON public.reports_monthly;

CREATE POLICY "reports_monthly_auth_read"
  ON public.reports_monthly
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

CREATE POLICY "reports_monthly_auth_insert"
  ON public.reports_monthly
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

CREATE POLICY "reports_monthly_auth_update"
  ON public.reports_monthly
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL)
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

CREATE POLICY "reports_monthly_auth_delete"
  ON public.reports_monthly
  FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

-- ═══════════════════════════════════════════════════════════════════════════
-- daily_ledger_entries
-- ═══════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "daily_ledger_auth_read" ON public.daily_ledger_entries;
DROP POLICY IF EXISTS "daily_ledger_auth_insert" ON public.daily_ledger_entries;
DROP POLICY IF EXISTS "daily_ledger_auth_update" ON public.daily_ledger_entries;
DROP POLICY IF EXISTS "daily_ledger_auth_delete" ON public.daily_ledger_entries;

CREATE POLICY "daily_ledger_auth_read"
  ON public.daily_ledger_entries
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

CREATE POLICY "daily_ledger_auth_insert"
  ON public.daily_ledger_entries
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "daily_ledger_auth_update"
  ON public.daily_ledger_entries
  FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()) OR (SELECT public.current_user_is_admin()))
  WITH CHECK (user_id = (SELECT auth.uid()) OR (SELECT public.current_user_is_admin()));

CREATE POLICY "daily_ledger_auth_delete"
  ON public.daily_ledger_entries
  FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()) OR (SELECT public.current_user_is_admin()));

-- ═══════════════════════════════════════════════════════════════════════════
-- manual_mappings (merge overlapping admin ALL + read/insert policies)
-- ═══════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "manual_mappings_admin_all" ON public.manual_mappings;
DROP POLICY IF EXISTS "manual_mappings_auth_read_active" ON public.manual_mappings;
DROP POLICY IF EXISTS "manual_mappings_authenticated_insert" ON public.manual_mappings;

CREATE POLICY "manual_mappings_auth_read"
  ON public.manual_mappings
  FOR SELECT
  TO authenticated
  USING (is_active = true OR (SELECT public.current_user_is_admin()));

CREATE POLICY "manual_mappings_auth_insert"
  ON public.manual_mappings
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

CREATE POLICY "manual_mappings_admin_update"
  ON public.manual_mappings
  FOR UPDATE
  TO authenticated
  USING ((SELECT public.current_user_is_admin()))
  WITH CHECK ((SELECT public.current_user_is_admin()));

CREATE POLICY "manual_mappings_admin_delete"
  ON public.manual_mappings
  FOR DELETE
  TO authenticated
  USING ((SELECT public.current_user_is_admin()));

-- ═══════════════════════════════════════════════════════════════════════════
-- user_profiles (merge admin + self SELECT into one policy)
-- ═══════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "user_profiles_admin_read" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_self_read" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_admin_insert" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_admin_update" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_admin_delete" ON public.user_profiles;

CREATE POLICY "user_profiles_auth_read"
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR (SELECT public.current_user_is_admin())
  );

CREATE POLICY "user_profiles_admin_insert"
  ON public.user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT public.current_user_is_admin()));

CREATE POLICY "user_profiles_admin_update"
  ON public.user_profiles
  FOR UPDATE
  TO authenticated
  USING ((SELECT public.current_user_is_admin()))
  WITH CHECK ((SELECT public.current_user_is_admin()));

CREATE POLICY "user_profiles_admin_delete"
  ON public.user_profiles
  FOR DELETE
  TO authenticated
  USING ((SELECT public.current_user_is_admin()));

NOTIFY pgrst, 'reload schema';
