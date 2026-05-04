-- Let signed-in users add manual mappings from the daily report UI ("Add to Mapping").
-- Admins retain full control via existing policies; updates/deletes stay admin-only.

CREATE POLICY "manual_mappings_authenticated_insert"
  ON manual_mappings
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
