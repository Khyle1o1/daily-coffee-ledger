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
