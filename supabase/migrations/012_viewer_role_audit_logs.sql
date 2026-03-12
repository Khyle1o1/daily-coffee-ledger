-- 012_viewer_role_audit_logs.sql
-- 1. Adds the "viewer" role to user_profiles
-- 2. Creates an audit_logs table for activity monitoring

-- ============================================================================
-- 1. ADD "viewer" TO THE role CHECK CONSTRAINT
-- ============================================================================
ALTER TABLE user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_role_check;

ALTER TABLE user_profiles
  ADD CONSTRAINT user_profiles_role_check
  CHECK (role IN ('admin', 'user', 'viewer'));

-- ============================================================================
-- 2. CREATE audit_logs TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email    TEXT        NOT NULL,
  user_role     TEXT        NOT NULL DEFAULT 'user',
  action        TEXT        NOT NULL,   -- e.g. login, add_data, generate_report
  module        TEXT        NOT NULL,   -- e.g. auth, summary, reports
  target_type   TEXT,                   -- e.g. daily_report, user, branch
  target_id     TEXT,
  target_name   TEXT,
  details       TEXT,                   -- human-readable summary
  metadata      JSONB       DEFAULT '{}',
  branch_id     UUID        REFERENCES branches(id) ON DELETE SET NULL,
  report_type   TEXT,
  ip_address    TEXT,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user_id    ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action     ON audit_logs(action);
CREATE INDEX idx_audit_logs_module     ON audit_logs(module);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_branch_id  ON audit_logs(branch_id);

-- ============================================================================
-- 3. RLS FOR audit_logs
-- - Any authenticated user can INSERT (append-only from the app)
-- - Only admins can SELECT
-- - Nobody can UPDATE or DELETE (immutable log)
-- ============================================================================
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_logs_insert_authenticated"
  ON audit_logs FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "audit_logs_select_admin"
  ON audit_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.user_id = auth.uid() AND up.role = 'admin'
    )
  );

-- ============================================================================
-- 4. HELPER FUNCTION: log_audit_event (callable from app via RPC if needed)
-- ============================================================================
CREATE OR REPLACE FUNCTION log_audit_event(
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
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO audit_logs (
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
$$ LANGUAGE plpgsql SECURITY DEFINER;
