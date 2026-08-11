import { createClient } from '@supabase/supabase-js';
import { pgQuery } from './migrate-new-db.mjs';

console.log(
  'new cols',
  await pgQuery(`
  SELECT column_name, data_type
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='directory_links'
  ORDER BY ordinal_position
`),
);

const old = createClient(
  'https://qdhlnhzkcqjsewrucfxk.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFkaGxuaHprY3Fqc2V3cnVjZnhrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTMzMzk0OSwiZXhwIjoyMDg2OTA5OTQ5fQ.2Oiatk-nctmzkz81Q5Xl_2B915LXZp6pzMQCsG-8WgQ',
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const { data, error } = await old.from('directory_links').select('*').limit(1);
console.log('old sample error', error?.message);
console.log('old sample keys', data?.[0] ? Object.keys(data[0]) : null);
