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

