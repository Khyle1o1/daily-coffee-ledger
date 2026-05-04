import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type ServerSupabase = SupabaseClient;

declare global {
  var __supabaseServerClient: ServerSupabase | undefined;
}

/**
 * Server-only singleton factory for Node/serverless runtimes.
 * Use pooled DATABASE_URL or service-role credentials from server env vars.
 */
export function getServerSupabaseClient(): ServerSupabase {
  if (globalThis.__supabaseServerClient) {
    return globalThis.__supabaseServerClient;
  }

  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  globalThis.__supabaseServerClient = createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  return globalThis.__supabaseServerClient;
}
