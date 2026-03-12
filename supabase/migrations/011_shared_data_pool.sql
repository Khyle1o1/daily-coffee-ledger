-- 011_shared_data_pool.sql
-- Make all report data shared across all authenticated users.
-- Previously each user had their own isolated copy of every report.
-- After this migration there is one shared record per branch per date/month,
-- visible and editable by every authenticated user.

-- ============================================================================
-- 1. DEDUPLICATE reports_daily
-- If multiple users saved a report for the same branch+date, keep the newest.
-- ============================================================================
DELETE FROM reports_daily a
USING reports_daily b
WHERE a.branch_id = b.branch_id
  AND a.report_date = b.report_date
  AND a.updated_at < b.updated_at;

-- ============================================================================
-- 2. RESTORE BRANCH-LEVEL UNIQUE CONSTRAINT FOR reports_daily
-- ============================================================================
ALTER TABLE reports_daily DROP CONSTRAINT IF EXISTS unique_user_branch_date;
ALTER TABLE reports_daily DROP CONSTRAINT IF EXISTS unique_branch_date;
ALTER TABLE reports_daily ADD CONSTRAINT unique_branch_date UNIQUE (branch_id, report_date);

-- ============================================================================
-- 3. DEDUPLICATE reports_monthly
-- branch_id is nullable (NULL = "all branches combined"), handle that case too.
-- ============================================================================
DELETE FROM reports_monthly a
USING reports_monthly b
WHERE (
    (a.branch_id = b.branch_id)
    OR (a.branch_id IS NULL AND b.branch_id IS NULL)
  )
  AND a.month_key = b.month_key
  AND a.updated_at < b.updated_at;

-- ============================================================================
-- 4. RESTORE BRANCH-LEVEL UNIQUE CONSTRAINT FOR reports_monthly
-- ============================================================================
ALTER TABLE reports_monthly DROP CONSTRAINT IF EXISTS unique_user_branch_month;
ALTER TABLE reports_monthly DROP CONSTRAINT IF EXISTS unique_branch_month;
ALTER TABLE reports_monthly ADD CONSTRAINT unique_branch_month UNIQUE (branch_id, month_key);

-- ============================================================================
-- 5. REPLACE ALL RESTRICTIVE RLS POLICIES ON reports_daily
-- ============================================================================
DROP POLICY IF EXISTS "reports_daily_user_read"     ON reports_daily;
DROP POLICY IF EXISTS "reports_daily_auth_read"     ON reports_daily;
DROP POLICY IF EXISTS "reports_daily_auth_insert"   ON reports_daily;
DROP POLICY IF EXISTS "reports_daily_auth_update"   ON reports_daily;
DROP POLICY IF EXISTS "reports_daily_auth_delete"   ON reports_daily;

CREATE POLICY "reports_daily_shared_read"
  ON reports_daily FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "reports_daily_shared_insert"
  ON reports_daily FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "reports_daily_shared_update"
  ON reports_daily FOR UPDATE
  USING  (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "reports_daily_shared_delete"
  ON reports_daily FOR DELETE
  USING (auth.role() = 'authenticated');

-- ============================================================================
-- 6. REPLACE ALL RESTRICTIVE RLS POLICIES ON reports_monthly
-- ============================================================================
DROP POLICY IF EXISTS "reports_monthly_user_read"   ON reports_monthly;
DROP POLICY IF EXISTS "reports_monthly_auth_read"   ON reports_monthly;
DROP POLICY IF EXISTS "reports_monthly_auth_insert" ON reports_monthly;
DROP POLICY IF EXISTS "reports_monthly_auth_update" ON reports_monthly;
DROP POLICY IF EXISTS "reports_monthly_auth_delete" ON reports_monthly;

CREATE POLICY "reports_monthly_shared_read"
  ON reports_monthly FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "reports_monthly_shared_insert"
  ON reports_monthly FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "reports_monthly_shared_update"
  ON reports_monthly FOR UPDATE
  USING  (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "reports_monthly_shared_delete"
  ON reports_monthly FOR DELETE
  USING (auth.role() = 'authenticated');
