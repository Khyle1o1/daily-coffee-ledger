-- 023: Fix function search_path + overly permissive RLS insert policies

-- ─── Function Search Path Mutable ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_user_profile(
  p_user_id UUID,
  p_email TEXT,
  p_role TEXT DEFAULT 'user',
  p_created_by UUID DEFAULT NULL
)
RETURNS public.user_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_profile public.user_profiles;
BEGIN
  INSERT INTO public.user_profiles (user_id, email, role, created_by)
  VALUES (p_user_id, p_email, p_role, p_created_by)
  RETURNING * INTO v_profile;

  RETURN v_profile;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_user_id     UUID,
  p_user_email  TEXT,
  p_user_role   TEXT,
  p_action      TEXT,
  p_module      TEXT,
  p_target_type TEXT DEFAULT NULL,
  p_target_id   TEXT DEFAULT NULL,
  p_target_name TEXT DEFAULT NULL,
  p_details     TEXT DEFAULT NULL,
  p_metadata    JSONB DEFAULT '{}',
  p_branch_id   UUID DEFAULT NULL,
  p_report_type TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.audit_logs (
    user_id, user_email, user_role, action, module,
    target_type, target_id, target_name, details, metadata,
    branch_id, report_type
  ) VALUES (
    p_user_id, p_user_email, p_user_role, p_action, p_module,
    p_target_type, p_target_id, p_target_name, p_details, p_metadata,
    p_branch_id, p_report_type
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Align admin helpers with empty search_path as well
CREATE OR REPLACE FUNCTION public.is_admin(user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
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
SET search_path = ''
AS $$
  SELECT public.is_admin(auth.uid());
$$;

-- ─── RLS Policy Always True (INSERT) ────────────────────────────────────────
-- Branches: authenticated read; admin-only writes
DROP POLICY IF EXISTS "branches_public_read" ON public.branches;
DROP POLICY IF EXISTS "branches_public_insert" ON public.branches;
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
  WITH CHECK (public.current_user_is_admin());

CREATE POLICY "branches_admin_update"
  ON public.branches
  FOR UPDATE
  TO authenticated
  USING (public.current_user_is_admin())
  WITH CHECK (public.current_user_is_admin());

CREATE POLICY "branches_admin_delete"
  ON public.branches
  FOR DELETE
  TO authenticated
  USING (public.current_user_is_admin());

-- Manual mappings: require a real authenticated user on insert
DROP POLICY IF EXISTS "manual_mappings_authenticated_insert" ON public.manual_mappings;
CREATE POLICY "manual_mappings_authenticated_insert"
  ON public.manual_mappings
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

NOTIFY pgrst, 'reload schema';
