-- =============================================================================
-- DAILY COFFEE LEDGER — FULL SCHEMA (all migrations in order)
-- Run this once in: Supabase Dashboard → SQL Editor → New query → Run
-- =============================================================================

-- ─── 001: initial_schema ─────────────────────────────────────────────────────
-- DOT Coffee Daily Summary - Initial Database Schema
-- This migration creates the core tables for the application

-- ============================================================================
-- 1. BRANCHES TABLE
-- ============================================================================
CREATE TABLE branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL CHECK (name IN ('greenbelt', 'podium', 'mind_museum', 'trinoma', 'uptown')),
  label TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index on name for faster lookups
CREATE INDEX idx_branches_name ON branches(name);

-- ============================================================================
-- 2. REPORTS_DAILY TABLE
-- ============================================================================
CREATE TABLE reports_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  report_date DATE NOT NULL,
  date_range_start DATE NOT NULL,
  date_range_end DATE NOT NULL,
  
  -- File information
  transactions_file_name TEXT,
  mapping_file_name TEXT,
  
  -- Computed summary data stored as JSONB
  summary_json JSONB NOT NULL,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure unique report per branch per date
  CONSTRAINT unique_branch_date UNIQUE (branch_id, report_date)
);

-- Create indexes for common queries
CREATE INDEX idx_reports_daily_branch ON reports_daily(branch_id);
CREATE INDEX idx_reports_daily_date ON reports_daily(report_date);
CREATE INDEX idx_reports_daily_date_range ON reports_daily(date_range_start, date_range_end);
CREATE INDEX idx_reports_daily_created_at ON reports_daily(created_at DESC);

-- GIN index for JSONB queries (if needed for future querying)
CREATE INDEX idx_reports_daily_summary_json ON reports_daily USING GIN (summary_json);

-- ============================================================================
-- 3. REPORTS_MONTHLY TABLE
-- ============================================================================
CREATE TABLE reports_monthly (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
  month_key TEXT NOT NULL, -- Format: YYYY-MM
  date_range_start DATE NOT NULL,
  date_range_end DATE NOT NULL,
  
  -- Computed monthly summary data stored as JSONB
  summary_json JSONB NOT NULL,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure unique report per branch per month (or all branches combined)
  CONSTRAINT unique_branch_month UNIQUE (branch_id, month_key),
  
  -- Validate month_key format (YYYY-MM)
  CONSTRAINT valid_month_key CHECK (month_key ~ '^\d{4}-\d{2}$')
);

-- Create indexes for common queries
CREATE INDEX idx_reports_monthly_branch ON reports_monthly(branch_id);
CREATE INDEX idx_reports_monthly_month_key ON reports_monthly(month_key);
CREATE INDEX idx_reports_monthly_date_range ON reports_monthly(date_range_start, date_range_end);
CREATE INDEX idx_reports_monthly_created_at ON reports_monthly(created_at DESC);

-- GIN index for JSONB queries
CREATE INDEX idx_reports_monthly_summary_json ON reports_monthly USING GIN (summary_json);

-- ============================================================================
-- 4. UPDATED_AT TRIGGER FUNCTION
-- ============================================================================
-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to branches
CREATE TRIGGER update_branches_updated_at
  BEFORE UPDATE ON branches
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to reports_daily
CREATE TRIGGER update_reports_daily_updated_at
  BEFORE UPDATE ON reports_daily
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to reports_monthly
CREATE TRIGGER update_reports_monthly_updated_at
  BEFORE UPDATE ON reports_monthly
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 5. SEED DEFAULT BRANCHES
-- ============================================================================
INSERT INTO branches (name, label) VALUES
  ('greenbelt', 'Greenbelt'),
  ('podium', 'Podium'),
  ('mind_museum', 'The Mind Museum'),
  ('trinoma', 'Trinoma'),
  ('uptown', 'Uptown')
ON CONFLICT (name) DO NOTHING;


-- ─── 002: rls_policies ───────────────────────────────────────────────────────
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


-- ─── 003: add_user_auth ──────────────────────────────────────────────────────
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


-- ─── 004: admin_system ───────────────────────────────────────────────────────
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
-- 1. Go to Supabase Dashboard â†’ Authentication â†’ Users
-- 2. Click "Add user" â†’ "Create new user"
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
--    Dashboard â†’ Authentication â†’ Settings â†’ "Enable email signups" â†’ OFF


-- ─── 005a: create_profiles_for_existing_users ────────────────────────────────
-- Create profiles for existing auth users who don't have profiles yet
-- This is a helper migration for backward compatibility

-- Insert profiles for any auth.users that don't have a profile yet
INSERT INTO user_profiles (user_id, email, role, created_by)
SELECT 
  au.id,
  au.email,
  'user' as role,  -- Default to 'user' role
  NULL as created_by
FROM auth.users au
LEFT JOIN user_profiles up ON au.id = up.user_id
WHERE up.user_id IS NULL;

-- Log the result
DO $$
DECLARE
  profile_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO profile_count FROM user_profiles;
  RAISE NOTICE 'Total user profiles: %', profile_count;
END $$;


-- ─── 005b: update_branches_check ─────────────────────────────────────────────
-- Update branches.name CHECK constraint to allow new branches
ALTER TABLE branches DROP CONSTRAINT IF EXISTS branches_name_check;

ALTER TABLE branches
  ADD CONSTRAINT branches_name_check
  CHECK (
    name IN (
      'greenbelt',
      'podium',
      'mind_museum',
      'trinoma',
      'uptown',
      'wgc',
      'wcc'
    )
  );

-- Ensure new branches exist
INSERT INTO branches (name, label) VALUES
  ('wgc', 'WGC'),
  ('wcc', 'WCC')
ON CONFLICT (name) DO NOTHING;



-- ─── 006a: add_greenbelt_greenhills ──────────────────────────────────────────
-- Expand allowed branches to include Greenbelt and Greenhills
ALTER TABLE branches DROP CONSTRAINT IF EXISTS branches_name_check;

ALTER TABLE branches
  ADD CONSTRAINT branches_name_check
  CHECK (
    name IN (
      'greenbelt',
      'greenhills',
      'podium',
      'mind_museum',
      'trinoma',
      'uptown',
      'wgc',
      'wcc'
    )
  );

-- Ensure new branches exist
INSERT INTO branches (name, label) VALUES
  ('greenbelt', 'Greenbelt'),
  ('greenhills', 'Greenhills')
ON CONFLICT (name) DO NOTHING;



-- ─── 006b: generated_reports ─────────────────────────────────────────────────
-- Migration: Add generated_reports table for saving HQ-style generated reports

CREATE TABLE IF NOT EXISTS public.generated_reports (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title          text        NOT NULL,
  report_type    text        NOT NULL,
  branch_id      uuid        REFERENCES public.branches(id) ON DELETE SET NULL,
  branch_name    text        NOT NULL DEFAULT '',
  date_from      text        NOT NULL,
  date_to        text        NOT NULL,
  compare_from   text,
  compare_to     text,
  selected_categories text[] NOT NULL DEFAULT '{}',
  filters        jsonb       NOT NULL DEFAULT '{}',
  computed_data  jsonb       NOT NULL DEFAULT '{}',
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.generated_reports ENABLE ROW LEVEL SECURITY;

-- Users can only manage their own generated reports
CREATE POLICY "generated_reports_owner_policy"
  ON public.generated_reports
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Index for fast queries by user + created_at
CREATE INDEX IF NOT EXISTS generated_reports_user_id_idx
  ON public.generated_reports (user_id);

CREATE INDEX IF NOT EXISTS generated_reports_created_at_idx
  ON public.generated_reports (created_at DESC);

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_generated_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER generated_reports_updated_at
  BEFORE UPDATE ON public.generated_reports
  FOR EACH ROW EXECUTE FUNCTION update_generated_reports_updated_at();


-- ─── 007: directory_links ────────────────────────────────────────────────────
-- DOT Coffee Daily Ledger - Directory Links
-- This migration adds the directory_links table for admin-managed redirect links

-- ============================================================================
-- 1. CREATE DIRECTORY_LINKS TABLE
-- ============================================================================
CREATE TABLE directory_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  url TEXT NOT NULL,
  description TEXT,
  category VARCHAR(100),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_directory_links_category ON directory_links(category);
CREATE INDEX idx_directory_links_is_active ON directory_links(is_active);
CREATE INDEX idx_directory_links_name ON directory_links(name);

-- ============================================================================
-- 2. ENABLE RLS ON DIRECTORY_LINKS
-- ============================================================================
ALTER TABLE directory_links ENABLE ROW LEVEL SECURITY;

-- All authenticated users can SELECT (needed for /directory/go/:id redirects)
CREATE POLICY "directory_links_auth_read"
  ON directory_links
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Only admins can insert
CREATE POLICY "directory_links_admin_insert"
  ON directory_links
  FOR INSERT
  WITH CHECK (current_user_is_admin());

-- Only admins can update
CREATE POLICY "directory_links_admin_update"
  ON directory_links
  FOR UPDATE
  USING (current_user_is_admin());

-- Only admins can delete
CREATE POLICY "directory_links_admin_delete"
  ON directory_links
  FOR DELETE
  USING (current_user_is_admin());

-- ============================================================================
-- 3. AUTO-UPDATE updated_at TRIGGER
-- ============================================================================
CREATE TRIGGER update_directory_links_updated_at
  BEFORE UPDATE ON directory_links
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SETUP NOTES
-- ============================================================================
-- Run this migration in Supabase SQL Editor.
-- The current_user_is_admin() function must already exist (from 004_admin_system.sql).
-- The update_updated_at_column() function must already exist (from 001_initial_schema.sql).


-- ─── 008: add_events_branch ──────────────────────────────────────────────────
-- Expand allowed branches to include Events
ALTER TABLE branches DROP CONSTRAINT IF EXISTS branches_name_check;

ALTER TABLE branches
  ADD CONSTRAINT branches_name_check
  CHECK (
    name IN (
      'greenbelt',
      'greenhills',
      'podium',
      'mind_museum',
      'trinoma',
      'uptown',
      'wgc',
      'wcc',
      'events'
    )
  );

-- Ensure Events branch exists
INSERT INTO branches (name, label) VALUES
  ('events', 'Events')
ON CONFLICT (name) DO NOTHING;



-- ─── 009: branch_management ──────────────────────────────────────────────────
-- Branch Management Enhancements
-- - Add management-friendly fields to branches
-- - Relax name constraint to allow new branches
-- - Add indexes for code and is_active

-- 1) Relax branches.name constraint to allow any non-empty value
ALTER TABLE branches DROP CONSTRAINT IF EXISTS branches_name_check;

-- 2) Add new columns if they don't exist yet
ALTER TABLE branches
  ADD COLUMN IF NOT EXISTS code TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- 3) Backfill code for existing branches where missing
UPDATE branches
SET code = UPPER(name)
WHERE code IS NULL;

-- 4) Enforce code uniqueness (one code per branch)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'branches_code_unique'
  ) THEN
    ALTER TABLE branches
      ADD CONSTRAINT branches_code_unique UNIQUE (code);
  END IF;
END
$$;

-- 5) Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_branches_is_active ON branches(is_active);
CREATE INDEX IF NOT EXISTS idx_branches_code ON branches(code);



-- ─── 010: manual_mappings ────────────────────────────────────────────────────
-- Manual Mappings
-- Allows admins to add runtime overrides to the transaction mapping pipeline.
-- Priority order in the app:
--   1. Active manual mappings (highest priority, sorted by priority DESC)
--   2. Built-in validation table (VALIDATION DATA.xlsx)
--   3. Fallback / UNMAPPED

CREATE TABLE IF NOT EXISTS manual_mappings (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source fields (what to match against in the transaction CSV)
  source_category  text NOT NULL DEFAULT '',
  source_item      text NOT NULL,
  source_option    text NOT NULL DEFAULT '',

  -- Output fields (what to emit when this row matches)
  mapped_category  text NOT NULL,
  mapped_item_name text NOT NULL,

  -- Control fields
  priority  integer  NOT NULL DEFAULT 0,      -- higher = checked earlier
  is_active boolean  NOT NULL DEFAULT true,
  notes     text,

  -- Pre-normalized lookup keys (maintained by the application layer)
  source_cat_norm  text NOT NULL DEFAULT '',
  source_item_norm text NOT NULL,
  source_opt_norm  text NOT NULL DEFAULT '',

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Prevent two active mappings for the exact same normalized source triple
CREATE UNIQUE INDEX IF NOT EXISTS idx_manual_mappings_active_uniq
  ON manual_mappings (source_cat_norm, source_item_norm, source_opt_norm)
  WHERE is_active = TRUE;

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_manual_mappings_is_active ON manual_mappings (is_active);
CREATE INDEX IF NOT EXISTS idx_manual_mappings_priority  ON manual_mappings (priority DESC);
CREATE INDEX IF NOT EXISTS idx_manual_mappings_item_norm ON manual_mappings (source_item_norm);

-- â”€â”€ Row-Level Security â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE manual_mappings ENABLE ROW LEVEL SECURITY;

-- Admins can do everything (read all rows including inactive)
CREATE POLICY "manual_mappings_admin_all"
  ON manual_mappings
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.role = 'admin'
    )
  );

-- Any authenticated user can SELECT active rows (needed by the mapping pipeline)
CREATE POLICY "manual_mappings_auth_read_active"
  ON manual_mappings
  FOR SELECT
  TO authenticated
  USING (is_active = TRUE);


-- ─── 011: shared_data_pool ───────────────────────────────────────────────────
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


-- ─── 012: viewer_role_audit_logs ─────────────────────────────────────────────
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


-- ─── 013: user_archive ───────────────────────────────────────────────────────
-- 013_user_archive.sql
-- Adds soft-archive support to user_profiles.
-- Users with existing audit log activity cannot be hard-deleted; they are
-- archived instead (profile flagged + auth account banned).

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS is_archived  BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS archived_at  TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_user_profiles_is_archived ON user_profiles(is_archived);


-- ─── 014: manual_mappings_authenticated_insert ───────────────────────────────
-- Let signed-in users add manual mappings from the daily report UI ("Add to Mapping").
-- Admins retain full control via existing policies; updates/deletes stay admin-only.

CREATE POLICY "manual_mappings_authenticated_insert"
  ON manual_mappings
  FOR INSERT
  TO authenticated
  WITH CHECK (true);


-- ─── 015: performance_indexes ────────────────────────────────────────────────
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


-- ─── 016: remove_generated_reports ──────────────────────────────────────────
-- Migration: remove generated report history storage to reduce DB load

-- Drop trigger first so table removal is clean in all environments.
DROP TRIGGER IF EXISTS generated_reports_updated_at ON public.generated_reports;

-- Remove trigger function if it exists.
DROP FUNCTION IF EXISTS public.update_generated_reports_updated_at();

-- Remove RLS policy if table still exists.
DROP POLICY IF EXISTS "generated_reports_owner_policy" ON public.generated_reports;

-- Remove the generated report history table.
DROP TABLE IF EXISTS public.generated_reports;


-- ─── 017: reports_daily_list_index ───────────────────────────────────────────
-- Support the paginated listAllDailyReports query which orders by
--   report_date DESC, branch_id ASC
-- and can optionally filter on branch_id, report_date range.
--
-- The existing idx_reports_daily_branch_report_date (branch_id, report_date DESC)
-- is used when a branchId filter is applied.  This new index covers the
-- full-table sort used by the unfiltered list and by date-range-only queries.

CREATE INDEX IF NOT EXISTS idx_reports_daily_date_branch
  ON public.reports_daily (report_date DESC, branch_id ASC);

