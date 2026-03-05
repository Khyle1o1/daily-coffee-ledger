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

