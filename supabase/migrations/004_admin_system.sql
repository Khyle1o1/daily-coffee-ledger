-- DOT Coffee Daily Summary - Admin System
-- This migration adds admin role management and user metadata

-- ============================================================================
-- 1. CREATE USER_PROFILES TABLE
-- ============================================================================
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX idx_user_profiles_role ON user_profiles(role);
CREATE INDEX idx_user_profiles_email ON user_profiles(email);

-- ============================================================================
-- 2. ENABLE RLS ON USER_PROFILES
-- ============================================================================
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Admins can view all user profiles
CREATE POLICY "user_profiles_admin_read"
  ON user_profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.user_id = auth.uid() AND up.role = 'admin'
    )
  );

-- Admins can insert user profiles
CREATE POLICY "user_profiles_admin_insert"
  ON user_profiles
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.user_id = auth.uid() AND up.role = 'admin'
    )
  );

-- Admins can update user profiles
CREATE POLICY "user_profiles_admin_update"
  ON user_profiles
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.user_id = auth.uid() AND up.role = 'admin'
    )
  );

-- Admins can delete user profiles (soft delete recommended instead)
CREATE POLICY "user_profiles_admin_delete"
  ON user_profiles
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.user_id = auth.uid() AND up.role = 'admin'
    )
  );

-- Users can view their own profile
CREATE POLICY "user_profiles_self_read"
  ON user_profiles
  FOR SELECT
  USING (user_id = auth.uid());

-- ============================================================================
-- 3. UPDATE TRIGGER FOR user_profiles
-- ============================================================================
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 4. CREATE INITIAL ADMIN USER
-- ============================================================================
-- IMPORTANT: You need to create the admin user in Supabase Auth first
-- Then insert the profile here with the user's UUID

-- Example (replace with actual UUID after creating user in Supabase Dashboard):
-- INSERT INTO user_profiles (user_id, email, role, created_by)
-- VALUES (
--   'USER_UUID_FROM_SUPABASE_AUTH',
--   'admin@dotcoffee.com',
--   'admin',
--   NULL
-- );

-- ============================================================================
-- 5. FUNCTION TO CHECK IF USER IS ADMIN
-- ============================================================================
CREATE OR REPLACE FUNCTION is_admin(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_id = user_uuid AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if current user is admin
CREATE OR REPLACE FUNCTION current_user_is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN is_admin(auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 6. FUNCTION TO CREATE USER PROFILE AFTER AUTH USER CREATION
-- ============================================================================
-- This function will be called from the application after creating a user
-- It ensures a profile is created for every auth user

CREATE OR REPLACE FUNCTION create_user_profile(
  p_user_id UUID,
  p_email TEXT,
  p_role TEXT DEFAULT 'user',
  p_created_by UUID DEFAULT NULL
)
RETURNS user_profiles AS $$
DECLARE
  v_profile user_profiles;
BEGIN
  INSERT INTO user_profiles (user_id, email, role, created_by)
  VALUES (p_user_id, p_email, p_role, p_created_by)
  RETURNING * INTO v_profile;
  
  RETURN v_profile;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 7. ADD ADMIN CHECK TO REPORTS (OPTIONAL - ADMINS SEE ALL DATA)
-- ============================================================================
-- This allows admins to view all reports, not just their own
-- Comment out if you want admins to only see their own reports

-- Drop existing read policies
DROP POLICY IF EXISTS "reports_daily_auth_read" ON reports_daily;
DROP POLICY IF EXISTS "reports_monthly_auth_read" ON reports_monthly;

-- New policies: Users see their own, Admins see all
CREATE POLICY "reports_daily_user_read"
  ON reports_daily
  FOR SELECT
  USING (
    auth.uid() = user_id 
    OR 
    current_user_is_admin()
  );

CREATE POLICY "reports_monthly_user_read"
  ON reports_monthly
  FOR SELECT
  USING (
    auth.uid() = user_id 
    OR 
    current_user_is_admin()
  );

-- ============================================================================
-- NOTES FOR SETUP
-- ============================================================================
-- After running this migration:
-- 
-- 1. Go to Supabase Dashboard → Authentication → Users
-- 2. Click "Add user" → "Create new user"
-- 3. Email: admin@dotcoffee.com (or your preferred admin email)
-- 4. Password: [set a strong password]
-- 5. Auto Confirm User: YES
-- 6. Copy the user's UUID
-- 
-- 7. Go to SQL Editor and run:
--    INSERT INTO user_profiles (user_id, email, role)
--    VALUES ('PASTE_UUID_HERE', 'admin@dotcoffee.com', 'admin');
-- 
-- 8. Disable public signups:
--    Dashboard → Authentication → Settings → "Enable email signups" → OFF
