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

