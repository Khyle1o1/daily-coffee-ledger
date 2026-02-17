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
