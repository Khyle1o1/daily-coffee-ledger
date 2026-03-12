// User Service - Admin User Management
// Handles user creation, profile management, and role checks

import { supabase, handleSupabaseError } from '@/lib/supabaseClient';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
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
    const { userId: currentUserId } = await requireAdminUser();

    const email = payload.email.trim();
    const password = payload.password ?? '';
    const validRoles = ['admin', 'user', 'viewer'] as const;
    const role: typeof validRoles[number] = validRoles.includes(payload.role as typeof validRoles[number])
      ? (payload.role as typeof validRoles[number])
      : 'user';

    if (!email) throw new Error('Email is required');
    if (!password || password.length < 6) throw new Error('Password must be at least 6 characters');

    // Create the auth user with service-role client (bypasses RLS, no edge function needed)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) throw new Error(`Failed to create auth user: ${authError.message}`);
    if (!authData.user) throw new Error('Failed to create auth user: no user returned');

    // Insert the matching user_profiles row
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .insert({ user_id: authData.user.id, email, role, created_by: currentUserId })
      .select('*')
      .single();

    if (profileError) {
      // Roll back the auth user so we don't leave orphans
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id).catch(() => null);
      throw new Error(`Failed to create user profile: ${profileError.message}`);
    }

    return profile as UserProfile;
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

/**
 * Archive a user — marks them as archived and bans their auth account so
 * they cannot sign in. Their data and audit logs are preserved.
 */
export async function archiveUser(userId: string): Promise<void> {
  try {
    await requireAdminUser();

    const { error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .update({ is_archived: true, archived_at: new Date().toISOString() })
      .eq('user_id', userId);

    if (profileError) throw new Error(`Failed to archive user profile: ${profileError.message}`);

    // Ban the auth account so they can't sign in (100 years)
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      ban_duration: '876600h',
    });

    if (authError) throw new Error(`Failed to ban auth account: ${authError.message}`);
  } catch (error) {
    console.error('archiveUser error:', error);
    throw new Error(handleSupabaseError(error));
  }
}

/**
 * Restore a previously archived user — unsets the archive flag and lifts the
 * auth ban so they can sign in again.
 */
export async function restoreUser(userId: string): Promise<void> {
  try {
    await requireAdminUser();

    const { error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .update({ is_archived: false, archived_at: null })
      .eq('user_id', userId);

    if (profileError) throw new Error(`Failed to restore user profile: ${profileError.message}`);

    // Lift the auth ban
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      ban_duration: 'none',
    });

    if (authError) throw new Error(`Failed to restore auth account: ${authError.message}`);
  } catch (error) {
    console.error('restoreUser error:', error);
    throw new Error(handleSupabaseError(error));
  }
}

/**
 * Returns a map of userId → audit log count for each given user ID.
 * Used to decide whether a user can be hard-deleted or must be archived.
 */
export async function getActivityCountsForUsers(
  userIds: string[]
): Promise<Record<string, number>> {
  if (userIds.length === 0) return {};
  try {
    const { data, error } = await supabaseAdmin
      .from('audit_logs')
      .select('user_id')
      .in('user_id', userIds);

    if (error) throw new Error(error.message);

    const counts: Record<string, number> = {};
    for (const row of data ?? []) {
      if (row.user_id) counts[row.user_id] = (counts[row.user_id] ?? 0) + 1;
    }
    return counts;
  } catch (error) {
    console.error('getActivityCountsForUsers error:', error);
    return {};
  }
}
