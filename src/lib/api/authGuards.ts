import { supabase, handleSupabaseError } from '@/lib/supabaseClient';
import type { UserRole } from '@/lib/supabase-types';

export class ApiAuthError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiAuthError';
    this.status = status;
  }
}

export interface AuthContext {
  userId: string;
  email: string | null;
  role: UserRole;
}

/**
 * Ensure there is an authenticated user and return their basic auth context.
 * Throws ApiAuthError(401) when there is no active session.
 */
export async function requireAuthUser(): Promise<AuthContext> {
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      throw new ApiAuthError('Unauthorized: you must be signed in.', 401);
    }

    // Look up role from user_profiles; default to "user" if missing.
    const { data, error: profileError } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (profileError && profileError.code !== 'PGRST116') {
      throw new Error(handleSupabaseError(profileError));
    }

    const role = (data?.role ?? 'user') as UserRole;

    return {
      userId: user.id,
      email: user.email ?? null,
      role,
    };
  } catch (error) {
    if (error instanceof ApiAuthError) {
      throw error;
    }
    console.error('requireAuthUser error:', error);
    throw new Error(handleSupabaseError(error));
  }
}

/**
 * Ensure the current user is an admin.
 * Throws:
 * - ApiAuthError(401) when not authenticated
 * - ApiAuthError(403) when authenticated but not an admin
 */
export async function requireAdminUser(): Promise<AuthContext> {
  const ctx = await requireAuthUser();

  if (ctx.role !== 'admin') {
    throw new ApiAuthError('Forbidden: admin access required.', 403);
  }

  return ctx;
}

