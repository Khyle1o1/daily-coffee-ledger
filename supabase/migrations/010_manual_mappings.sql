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

-- ── Row-Level Security ────────────────────────────────────────────────────────
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
