import { createClient } from '@supabase/supabase-js';
import type { Database } from './supabase.types';

// Get environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validate environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env.local file.'
  );
}

// ─── Local promise-queue mutex ────────────────────────────────────────────────
// Replaces the default Navigator LockManager so concurrent auth operations
// (e.g. multiple getUser() calls fired at startup) queue up locally instead of
// competing for an exclusive cross-tab OS lock that times out after 10 s.
// This is safe for a single-tab SPA; the Navigator lock is only needed to
// synchronise sessions across browser tabs, which is not required here.
const _lockQueues = new Map<string, Promise<unknown>>();

function localLock<R>(
  name: string,
  _acquireTimeout: number,
  fn: () => Promise<R>,
): Promise<R> {
  const prev = _lockQueues.get(name) ?? Promise.resolve();
  // Chain on the previous operation — always run fn even if prev rejected
  const next = prev.then(() => fn(), () => fn()) as Promise<R>;
  // Store only a void-settled tail so the chain never grows unboundedly
  _lockQueues.set(name, next.then(() => undefined, () => undefined));
  return next;
}

// Create Supabase client
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // Use the local mutex above instead of navigator.locks so concurrent auth
    // calls at startup never trigger NavigatorLockAcquireTimeoutError.
    lock: localLock,
  },
});

// Expose Supabase URL for building Edge Function URLs
export const SUPABASE_URL = supabaseUrl;
export const SUPABASE_ANON_KEY = supabaseAnonKey;

// Helper function to handle Supabase errors
export function handleSupabaseError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return 'An unknown error occurred with Supabase';
}

// Test connection helper
export async function testSupabaseConnection(): Promise<boolean> {
  try {
    const { error } = await supabase.from('branches').select('count').limit(1);
    if (error) {
      console.error('Supabase connection test failed:', error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Supabase connection test failed:', error);
    return false;
  }
}
