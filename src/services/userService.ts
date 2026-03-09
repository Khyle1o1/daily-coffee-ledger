// User Service - Admin User Management
// Handles user creation, profile management, and role checks

import { supabase, handleSupabaseError, SUPABASE_ANON_KEY } from '@/lib/supabaseClient';
import type { UserProfile, CreateUserPayload, UpdateUserPayload } from '@/lib/supabase-types';
import { requireAdminUser } from '@/lib/api/authGuards';

// ============================================================================
// ROLE CHECKING
// ============================================================================

/**
 * Check if the current user is an admin
 */
export async function isCurrentUserAdmin(): Promise<boolean> {
  try {
    console.log('[userService] 🔍 Checking if user is admin...');
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.log('[userService] ❌ No user found');
      return false;
    }

    console.log('[userService] 👤 User ID:', user.id);
    console.log('[userService] 📧 Email:', user.email);

    const { data, error } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('[userService] ❌ ERROR checking admin status:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
        fullError: error
      });
      
      if (error.code === 'PGRST204') {
        console.log('[userService] ℹ️  No profile found (table might not exist)');
      } else if (error.message.includes('relation') && error.message.includes('does not exist')) {
        console.error('[userService] 🚨 USER_PROFILES TABLE DOES NOT EXIST!');
        console.error('[userService] 👉 YOU MUST RUN SETUP_DATABASE.SQL IN SUPABASE!');
      }
      
      return false;
    }

    console.log('[userService] ✅ Profile data:', data);
    const isAdmin = data?.role === 'admin';
    console.log('[userService] 🔐 Is Admin?', isAdmin);
    
    return isAdmin;
  } catch (error) {
    console.error('[userService] 💥 EXCEPTION in isCurrentUserAdmin:', error);
    return false;
  }
}

/**
 * Get current user's profile
 */
export async function getCurrentUserProfile(): Promise<UserProfile | null> {
  try {
    console.log('[userService] 📋 Fetching user profile...');
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.log('[userService] ❌ No user found');
      return null;
    }

    console.log('[userService] 👤 User ID:', user.id);
    console.log('[userService] 📧 Email:', user.email);

    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('[userService] ❌ ERROR fetching user profile:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
        fullError: error
      });
      
      if (error.message.includes('relation') && error.message.includes('does not exist')) {
        console.error('[userService] 🚨 USER_PROFILES TABLE DOES NOT EXIST!');
        console.error('[userService] 👉 RUN THIS IN SUPABASE SQL EDITOR:');
        console.error('[userService] 👉 Open file: SETUP_DATABASE.sql');
        console.error('[userService] 👉 Copy all content and paste in SQL Editor');
        console.error('[userService] 👉 Click RUN button');
      }
      
      return null;
    }

    if (data) {
      console.log('[userService] ✅ Profile found:', {
        email: data.email,
        role: data.role,
        created_at: data.created_at
      });
    } else {
      console.log('[userService] ⚠️  No profile found for user');
      console.log('[userService] 👉 Profile might not exist in database');
    }

    return data as UserProfile | null;
  } catch (error) {
    console.error('[userService] 💥 EXCEPTION in getCurrentUserProfile:', error);
    return null;
  }
}

// ============================================================================
// USER MANAGEMENT (ADMIN ONLY)
// ============================================================================

/**
 * Create a new user (admin only)
 */
export async function createUser(payload: CreateUserPayload): Promise<UserProfile> {
  try {
    // Quick client-side admin check (server will still verify)
    await requireAdminUser();

    const {
      data: { session },
    } = await supabase.auth.getSession();

    // Ensure we have a fresh access token (helps when auto-refresh hasn't run yet)
    const {
      data: { session: refreshedSession },
    } = await supabase.auth.refreshSession();

    const accessToken = refreshedSession?.access_token ?? session?.access_token;
    const tokenParts = accessToken ? accessToken.split('.').length : 0;

    if (!accessToken || tokenParts !== 3) {
      // If this happens while you're "signed in", the session in storage is corrupted or missing.
      throw new Error('Authentication session is invalid. Please sign out and sign in again.');
    }

    const { data, error } = await supabase.functions.invoke('admin-create-user', {
      body: {
        email: payload.email,
        password: payload.password,
        role: payload.role || 'user',
      },
      // Be explicit to avoid any edge cases where the invoke call doesn't attach auth
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (error) {
      // supabase-js wraps function errors; try to extract the function's JSON error message
      const anyErr = error as unknown as { status?: number; message?: string; context?: unknown };
      const ctx = anyErr.context as any;

      const status: number | undefined =
        anyErr.status ??
        (typeof ctx?.status === 'number' ? ctx.status : undefined) ??
        (typeof ctx?.statusCode === 'number' ? ctx.statusCode : undefined);

      let serverMessage: string | undefined;
      // supabase-js v2 typically provides a Response in `context`, but `instanceof Response`
      // can fail across realms/bundles; use duck-typing instead.
      if (ctx && typeof ctx === 'object') {
        try {
          if (typeof ctx.clone === 'function' && typeof ctx.json === 'function') {
            const json = (await ctx.clone().json()) as { error?: string; message?: string };
            serverMessage = json?.error ?? json?.message;
          } else if (typeof ctx.json === 'function') {
            const json = (await ctx.json()) as { error?: string; message?: string };
            serverMessage = json?.error ?? json?.message;
          } else if (typeof ctx.body === 'string') {
            const parsed = JSON.parse(ctx.body) as { error?: string; message?: string };
            serverMessage = parsed?.error ?? parsed?.message;
          }
        } catch {
          // ignore
        }
      }

      const message = serverMessage
        ? serverMessage
        : status === 401
          ? 'You must be signed in to create users'
          : status === 403
            ? 'Only admins can create users'
            : anyErr.message || 'Failed to create user';
      throw new Error(message);
    }

    const body = data as { profile?: UserProfile; error?: string } | null;
    if (!body?.profile) {
      throw new Error(body?.error || 'Failed to create user: missing profile data from server');
    }

    return body.profile;
  } catch (error) {
    console.error('createUser error:', error);
    throw new Error(handleSupabaseError(error));
  }
}

/**
 * List all user profiles (admin only)
 */
export async function listAllUsers(): Promise<UserProfile[]> {
  try {
    // Verify current user is admin
    await requireAdminUser();

    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to list users: ${error.message}`);
    }

    return (data as UserProfile[]) || [];
  } catch (error) {
    console.error('listAllUsers error:', error);
    throw new Error(handleSupabaseError(error));
  }
}

/**
 * Get a user profile by ID (admin only)
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  try {
    // Verify current user is admin
    await requireAdminUser();

    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to fetch user profile: ${error.message}`);
    }

    return data as UserProfile;
  } catch (error) {
    console.error('getUserProfile error:', error);
    throw new Error(handleSupabaseError(error));
  }
}

/**
 * Update a user profile (admin only)
 */
export async function updateUserProfile(
  userId: string,
  updates: UpdateUserPayload
): Promise<UserProfile> {
  try {
    // Verify current user is admin
    await requireAdminUser();

    const { data, error } = await supabase
      .from('user_profiles')
      .update(updates)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update user profile: ${error.message}`);
    }

    return data as UserProfile;
  } catch (error) {
    console.error('updateUserProfile error:', error);
    throw new Error(handleSupabaseError(error));
  }
}

/**
 * Delete a user (admin only)
 * This deletes both the auth user and profile
 */
export async function deleteUser(userId: string): Promise<void> {
  try {
    // Verify current user is admin
    const { userId: currentUserId } = await requireAdminUser();

    // Check if trying to delete themselves
    if (currentUserId === userId) {
      throw new Error('You cannot delete your own account');
    }

    // Delete the auth user (profile will be cascade deleted)
    const { error: authError } = await supabase.auth.admin.deleteUser(userId);

    if (authError) {
      throw new Error(`Failed to delete user: ${authError.message}`);
    }
  } catch (error) {
    console.error('deleteUser error:', error);
    throw new Error(handleSupabaseError(error));
  }
}

/**
 * Reset a user's password (admin only)
 */
export async function resetUserPassword(
  userId: string,
  newPassword: string
): Promise<void> {
  try {
    // Verify current user is admin
    await requireAdminUser();

    const { error } = await supabase.auth.admin.updateUserById(userId, {
      password: newPassword,
    });

    if (error) {
      throw new Error(`Failed to reset password: ${error.message}`);
    }
  } catch (error) {
    console.error('resetUserPassword error:', error);
    throw new Error(handleSupabaseError(error));
  }
}
