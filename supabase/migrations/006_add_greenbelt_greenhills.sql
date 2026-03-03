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

