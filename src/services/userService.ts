// User Service - Admin User Management
// Handles user creation, profile management, and role checks

import { supabase, handleSupabaseError } from '@/lib/supabaseClient';
import type { UserProfile, CreateUserPayload, UpdateUserPayload } from '@/lib/supabase-types';

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
    // Verify current user is admin
    const isAdmin = await isCurrentUserAdmin();
    if (!isAdmin) {
      throw new Error('Only admins can create users');
    }

    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) {
      throw new Error('You must be authenticated');
    }

    // Create the auth user via Supabase Admin API
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: payload.email,
      password: payload.password,
      email_confirm: true, // Auto-confirm email
    });

    if (authError) {
      throw new Error(`Failed to create auth user: ${authError.message}`);
    }

    if (!authData.user) {
      throw new Error('Failed to create auth user: No user returned');
    }

    // Create the user profile
    const { data: profileData, error: profileError } = await supabase
      .from('user_profiles')
      .insert({
        user_id: authData.user.id,
        email: payload.email,
        role: payload.role || 'user',
        created_by: currentUser.id,
      })
      .select()
      .single();

    if (profileError) {
      // Try to clean up the auth user if profile creation fails
      await supabase.auth.admin.deleteUser(authData.user.id);
      throw new Error(`Failed to create user profile: ${profileError.message}`);
    }

    return profileData as UserProfile;
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
    const isAdmin = await isCurrentUserAdmin();
    if (!isAdmin) {
      throw new Error('Only admins can list users');
    }

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
    const isAdmin = await isCurrentUserAdmin();
    if (!isAdmin) {
      throw new Error('Only admins can view user profiles');
    }

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
    const isAdmin = await isCurrentUserAdmin();
    if (!isAdmin) {
      throw new Error('Only admins can update user profiles');
    }

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
    const isAdmin = await isCurrentUserAdmin();
    if (!isAdmin) {
      throw new Error('Only admins can delete users');
    }

    // Check if trying to delete themselves
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (currentUser?.id === userId) {
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
    const isAdmin = await isCurrentUserAdmin();
    if (!isAdmin) {
      throw new Error('Only admins can reset passwords');
    }

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
