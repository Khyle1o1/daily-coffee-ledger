import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './supabase.types';

/**
 * SECURITY WARNING: This module is DEPRECATED for browser use.
 *
 * The service-role key should NEVER be exposed in client-side code.
 * If VITE_SUPABASE_SERVICE_ROLE_KEY is ever set in a production build,
 * it would be bundled into the browser and leak to all users.
 *
 * This client is currently used for admin operations (user management,
 * data wipe) which should eventually be migrated to:
 * - Supabase Edge Functions, OR
 * - A backend API route (e.g., Vercel serverless functions)
 *
 * For now, the admin UI simply won't work unless the env var is set
 * in local development. Production deployments should NOT set this var.
 *
 * @deprecated Migrate admin operations to server-side edge functions.
 */

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const serviceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY as string;

let _supabaseAdmin: SupabaseClient<Database> | null = null;

function getAdminClient(): SupabaseClient<Database> {
  if (_supabaseAdmin) return _supabaseAdmin;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Admin operations require VITE_SUPABASE_SERVICE_ROLE_KEY (local dev only). ' +
      'Do NOT set this in production — it would leak to the browser bundle.'
    );
  }

  _supabaseAdmin = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: 'sb-admin-service-role',
    },
  });

  return _supabaseAdmin;
}

/**
 * Service-role client for admin operations.
 * Lazily initialized to avoid throwing at import time.
 *
 * @deprecated Use server-side functions instead of exposing service role to browser.
 */
export const supabaseAdmin = new Proxy({} as SupabaseClient<Database>, {
  get(_target, prop) {
    const client = getAdminClient();
    const value = client[prop as keyof SupabaseClient<Database>];
    return typeof value === 'function' ? value.bind(client) : value;
  },
});
