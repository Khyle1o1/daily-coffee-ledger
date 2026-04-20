import { createClient } from '@supabase/supabase-js';
import type { Database } from './supabase.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const serviceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY as string;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    'Missing VITE_SUPABASE_SERVICE_ROLE_KEY. Add it to your .env file to enable admin operations.'
  );
}

// Service-role client — bypasses RLS, used only for admin operations
// (creating/deleting users). Never expose serviceRoleKey in public-facing code.
//
// storageKey is set to a distinct value so this client's GoTrueClient instance
// does not share a storage namespace with the regular anon client, which would
// trigger the "Multiple GoTrueClient instances" warning and risk undefined
// behaviour when both clients are active in the same browser tab.
export const supabaseAdmin = createClient<Database>(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
    storageKey: 'sb-admin-service-role',
  },
});
