-- DOT Coffee Daily Summary - Row Level Security Policies
-- This migration sets up RLS policies for secure data access

-- ============================================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports_monthly ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- DEVELOPMENT MODE POLICIES (Public Read/Write)
-- ============================================================================
-- IMPORTANT: These policies allow public access for development.
-- Replace these with proper authentication-based policies before production.

-- Branches: Public read access
CREATE POLICY "branches_public_read"
  ON branches
  FOR SELECT
  USING (true);

-- Branches: Public insert (for seeding if needed)
CREATE POLICY "branches_public_insert"
  ON branches
  FOR INSERT
  WITH CHECK (true);

-- Reports Daily: Public read access
CREATE POLICY "reports_daily_public_read"
  ON reports_daily
  FOR SELECT
  USING (true);

-- Reports Daily: Public insert
CREATE POLICY "reports_daily_public_insert"
  ON reports_daily
  FOR INSERT
  WITH CHECK (true);

-- Reports Daily: Public update
CREATE POLICY "reports_daily_public_update"
  ON reports_daily
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Reports Daily: Public delete
CREATE POLICY "reports_daily_public_delete"
  ON reports_daily
  FOR DELETE
  USING (true);

-- Reports Monthly: Public read access
CREATE POLICY "reports_monthly_public_read"
  ON reports_monthly
  FOR SELECT
  USING (true);

-- Reports Monthly: Public insert
CREATE POLICY "reports_monthly_public_insert"
  ON reports_monthly
  FOR INSERT
  WITH CHECK (true);

-- Reports Monthly: Public update
CREATE POLICY "reports_monthly_public_update"
  ON reports_monthly
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Reports Monthly: Public delete
CREATE POLICY "reports_monthly_public_delete"
  ON reports_monthly
  FOR DELETE
  USING (true);

-- ============================================================================
-- FUTURE: AUTHENTICATED USER POLICIES (Commented Out)
-- ============================================================================
-- Uncomment and modify these when implementing authentication
-- Remember to add user_id columns to reports tables

/*
-- Add user_id columns (run this migration separately when adding auth)
ALTER TABLE reports_daily ADD COLUMN user_id UUID REFERENCES auth.users(id);
ALTER TABLE reports_monthly ADD COLUMN user_id UUID REFERENCES auth.users(id);

-- Drop public policies
DROP POLICY IF EXISTS "reports_daily_public_read" ON reports_daily;
DROP POLICY IF EXISTS "reports_daily_public_insert" ON reports_daily;
DROP POLICY IF EXISTS "reports_daily_public_update" ON reports_daily;
DROP POLICY IF EXISTS "reports_daily_public_delete" ON reports_daily;
DROP POLICY IF EXISTS "reports_monthly_public_read" ON reports_monthly;
DROP POLICY IF EXISTS "reports_monthly_public_insert" ON reports_monthly;
DROP POLICY IF EXISTS "reports_monthly_public_update" ON reports_monthly;
DROP POLICY IF EXISTS "reports_monthly_public_delete" ON reports_monthly;

-- Reports Daily: Authenticated policies
CREATE POLICY "reports_daily_auth_read"
  ON reports_daily
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "reports_daily_auth_insert"
  ON reports_daily
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "reports_daily_auth_update"
  ON reports_daily
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "reports_daily_auth_delete"
  ON reports_daily
  FOR DELETE
  USING (auth.uid() = user_id);

-- Reports Monthly: Authenticated policies
CREATE POLICY "reports_monthly_auth_read"
  ON reports_monthly
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "reports_monthly_auth_insert"
  ON reports_monthly
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "reports_monthly_auth_update"
  ON reports_monthly
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "reports_monthly_auth_delete"
  ON reports_monthly
  FOR DELETE
  USING (auth.uid() = user_id);
*/
