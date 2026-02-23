-- DOT Coffee Daily Summary - Add User Authentication
-- This migration adds user_id columns and updates RLS policies for authenticated access

-- ============================================================================
-- 1. ADD USER_ID COLUMNS
-- ============================================================================

-- Add user_id to reports_daily
ALTER TABLE reports_daily 
  ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add user_id to reports_monthly
ALTER TABLE reports_monthly 
  ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create indexes for user_id lookups
CREATE INDEX idx_reports_daily_user_id ON reports_daily(user_id);
CREATE INDEX idx_reports_monthly_user_id ON reports_monthly(user_id);

-- Update unique constraints to include user_id
-- Drop old constraint and create new one that includes user_id
ALTER TABLE reports_daily DROP CONSTRAINT IF EXISTS unique_branch_date;
ALTER TABLE reports_daily ADD CONSTRAINT unique_user_branch_date UNIQUE (user_id, branch_id, report_date);

ALTER TABLE reports_monthly DROP CONSTRAINT IF EXISTS unique_branch_month;
ALTER TABLE reports_monthly ADD CONSTRAINT unique_user_branch_month UNIQUE (user_id, branch_id, month_key);

-- ============================================================================
-- 2. DROP PUBLIC POLICIES
-- ============================================================================

-- Drop all public policies for reports_daily
DROP POLICY IF EXISTS "reports_daily_public_read" ON reports_daily;
DROP POLICY IF EXISTS "reports_daily_public_insert" ON reports_daily;
DROP POLICY IF EXISTS "reports_daily_public_update" ON reports_daily;
DROP POLICY IF EXISTS "reports_daily_public_delete" ON reports_daily;

-- Drop all public policies for reports_monthly
DROP POLICY IF EXISTS "reports_monthly_public_read" ON reports_monthly;
DROP POLICY IF EXISTS "reports_monthly_public_insert" ON reports_monthly;
DROP POLICY IF EXISTS "reports_monthly_public_update" ON reports_monthly;
DROP POLICY IF EXISTS "reports_monthly_public_delete" ON reports_monthly;

-- ============================================================================
-- 3. CREATE AUTHENTICATED USER POLICIES - REPORTS_DAILY
-- ============================================================================

-- Users can only read their own daily reports
CREATE POLICY "reports_daily_auth_read"
  ON reports_daily
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can only insert their own daily reports
CREATE POLICY "reports_daily_auth_insert"
  ON reports_daily
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can only update their own daily reports
CREATE POLICY "reports_daily_auth_update"
  ON reports_daily
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can only delete their own daily reports
CREATE POLICY "reports_daily_auth_delete"
  ON reports_daily
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- 4. CREATE AUTHENTICATED USER POLICIES - REPORTS_MONTHLY
-- ============================================================================

-- Users can only read their own monthly reports
CREATE POLICY "reports_monthly_auth_read"
  ON reports_monthly
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can only insert their own monthly reports
CREATE POLICY "reports_monthly_auth_insert"
  ON reports_monthly
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can only update their own monthly reports
CREATE POLICY "reports_monthly_auth_update"
  ON reports_monthly
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can only delete their own monthly reports
CREATE POLICY "reports_monthly_auth_delete"
  ON reports_monthly
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- 5. NOTE ABOUT EXISTING DATA
-- ============================================================================
-- IMPORTANT: Existing reports without user_id will not be visible to any user.
-- If you need to migrate existing data, run:
-- UPDATE reports_daily SET user_id = '<specific-user-uuid>' WHERE user_id IS NULL;
-- UPDATE reports_monthly SET user_id = '<specific-user-uuid>' WHERE user_id IS NULL;
