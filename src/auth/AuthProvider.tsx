import { createContext, useEffect, useState, ReactNode } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';
import { getCurrentUserProfile, isCurrentUserAdmin } from '@/services/userService';
import type { UserProfile } from '@/lib/supabase-types';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  isAdmin: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUp: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: AuthError | null }>;
  refreshProfile: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (currentUser: User | null) => {
    console.log('[AuthProvider] 🔄 Loading user profile...');
    
    if (!currentUser) {
      console.log('[AuthProvider] ❌ No current user, skipping profile load');
      setProfile(null);
      setIsAdmin(false);
      return;
    }

    console.log('[AuthProvider] 👤 Current user:', {
      id: currentUser.id,
      email: currentUser.email
    });

    try {
      console.log('[AuthProvider] 📡 Fetching profile from database...');
      
      // Add timeout to prevent infinite hanging
      const timeout = new Promise<null>((_, reject) => {
        setTimeout(() => reject(new Error('Profile load timeout after 5 seconds')), 5000);
      });
      
      // Load profile with timeout
      const userProfile = await Promise.race([
        getCurrentUserProfile(),
        timeout
      ]).catch((err) => {
        console.error('[AuthProvider] ❌ Failed to get profile:', err);
        return null;
      });
      
      // Load admin status with timeout
      const adminStatus = await Promise.race([
        isCurrentUserAdmin(),
        timeout
      ]).catch((err) => {
        console.error('[AuthProvider] ❌ Failed to check admin status:', err);
        return false;
      });
      
      console.log('[AuthProvider] ✅ Profile loaded:', {
        hasProfile: !!userProfile,
        isAdmin: adminStatus,
        profile: userProfile
      });
      
      setProfile(userProfile);
      setIsAdmin(adminStatus);
    } catch (error) {
      console.error('[AuthProvider] 💥 EXCEPTION loading profile:', error);
      setProfile(null);
      setIsAdmin(false);
    }
  };

  useEffect(() => {
    console.log('[AuthProvider] 🚀 Initializing auth system...');
    
    // Get initial session
    const initializeAuth = async () => {
      try {
        console.log('[AuthProvider] 📡 Getting session from Supabase...');
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        
        console.log('[AuthProvider] ✅ Session retrieved:', {
          hasSession: !!initialSession,
          hasUser: !!initialSession?.user,
          userEmail: initialSession?.user?.email
        });
        
        setSession(initialSession);
        setUser(initialSession?.user ?? null);
        await loadProfile(initialSession?.user ?? null);
      } catch (error) {
        console.error('[AuthProvider] ❌ Error getting session:', error);
      } finally {
        console.log('[AuthProvider] ✅ Auth initialization complete, setting loading=false');
        setLoading(false);
      }
    };

    initializeAuth();

    // Listen for auth changes
    console.log('[AuthProvider] 👂 Setting up auth state change listener...');
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        console.log('[AuthProvider] 🔔 Auth state changed:', event, {
          hasSession: !!currentSession,
          hasUser: !!currentSession?.user,
          userEmail: currentSession?.user?.email
        });
        
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        await loadProfile(currentSession?.user ?? null);
        setLoading(false);
      }
    );

    return () => {
      console.log('[AuthProvider] 🔌 Unsubscribing from auth changes');
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      return { error };
    } catch (error) {
      return { error: error as AuthError };
    }
  };

  const signUp = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });
      return { error };
    } catch (error) {
      return { error: error as AuthError };
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      return { error };
    } catch (error) {
      return { error: error as AuthError };
    }
  };

  const updatePassword = async (newPassword: string) => {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      return { error };
    } catch (error) {
      return { error: error as AuthError };
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await loadProfile(user);
    }
  };

  const value: AuthContextType = {
    user,
    session,
    profile,
    isAdmin,
    loading,
    signIn,
    signUp,
    signOut,
    resetPassword,
    updatePassword,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
