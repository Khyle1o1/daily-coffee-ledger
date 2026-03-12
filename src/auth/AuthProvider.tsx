import { createContext, useEffect, useState, useRef, ReactNode } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';
import { getCurrentUserProfile, isCurrentUserAdmin } from '@/services/userService';
import { logEvent } from '@/services/auditService';
import type { UserProfile, UserRole } from '@/lib/supabase-types';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  role: UserRole | null;
  isAdmin: boolean;
  isViewer: boolean;
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

interface CachedProfile {
  userId: string;
  profile: UserProfile | null;
  isAdmin: boolean;
  timestamp: number;
}

// Bump version to instantly evict any stale cached data
const PROFILE_CACHE_KEY = 'auth_profile_cache_v2';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isViewer, setIsViewer] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const isLoadingProfile = useRef(false);
  const lastLoadedUserId = useRef<string | null>(null);

  const getCachedProfile = (userId: string): CachedProfile | null => {
    try {
      const cached = sessionStorage.getItem(PROFILE_CACHE_KEY);
      if (!cached) return null;
      
      const data: CachedProfile = JSON.parse(cached);
      
      // Check if cache is for same user and not expired
      if (data.userId === userId && Date.now() - data.timestamp < CACHE_DURATION) {
        console.log('[AuthProvider] 💾 Using cached profile');
        return data;
      }
      
      return null;
    } catch (error) {
      console.error('[AuthProvider] ❌ Error reading cache:', error);
      return null;
    }
  };

  const setCachedProfile = (userId: string, profile: UserProfile | null, isAdmin: boolean) => {
    try {
      const data: CachedProfile = {
        userId,
        profile,
        isAdmin,
        timestamp: Date.now()
      };
      sessionStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('[AuthProvider] ❌ Error writing cache:', error);
    }
  };

  const clearCachedProfile = () => {
    try {
      sessionStorage.removeItem(PROFILE_CACHE_KEY);
    } catch (error) {
      console.error('[AuthProvider] ❌ Error clearing cache:', error);
    }
  };

  const loadProfile = async (currentUser: User | null, force = false) => {
    console.log('[AuthProvider] 🔄 Loading user profile...');
    
    if (!currentUser) {
      console.log('[AuthProvider] ❌ No current user, skipping profile load');
      setProfile(null);
      setRole(null);
      setIsAdmin(false);
      setIsViewer(false);
      clearCachedProfile();
      lastLoadedUserId.current = null;
      return;
    }

    // Skip if already loading
    if (isLoadingProfile.current) {
      console.log('[AuthProvider] ⏭️  Profile already loading, skipping duplicate request');
      return;
    }

    // Skip if same user already loaded and not forcing
    if (!force && lastLoadedUserId.current === currentUser.id) {
      console.log('[AuthProvider] ⏭️  Profile already loaded for this user, skipping');
      return;
    }

    console.log('[AuthProvider] 👤 Current user:', {
      id: currentUser.id,
      email: currentUser.email
    });

    // Try to use cached profile first
    if (!force) {
      const cached = getCachedProfile(currentUser.id);
      if (cached) {
        setProfile(cached.profile);
        setIsAdmin(cached.isAdmin);
        lastLoadedUserId.current = currentUser.id;
        return;
      }
    }

    // Set loading flag
    isLoadingProfile.current = true;

    try {
      console.log('[AuthProvider] 📡 Fetching profile from database...');

      const [profileResult, adminResult] = await Promise.allSettled([
        getCurrentUserProfile(),
        isCurrentUserAdmin(),
      ]);

      let userProfile: UserProfile | null = null;
      if (profileResult.status === 'fulfilled') {
        userProfile = profileResult.value;
      } else {
        console.error('[AuthProvider] ❌ Failed to get profile:', profileResult.reason);
      }

      let adminStatus = false;
      if (adminResult.status === 'fulfilled') {
        adminStatus = adminResult.value;
      } else {
        console.error('[AuthProvider] ❌ Failed to check admin status:', adminResult.reason);
      }

      console.log('[AuthProvider] ✅ Profile loaded:', {
        hasProfile: !!userProfile,
        isAdmin: adminStatus,
        profile: userProfile
      });

      const userRole = (userProfile?.role ?? null) as UserRole | null;
      setProfile(userProfile);
      setRole(userRole);
      setIsAdmin(adminStatus);
      setIsViewer(userRole === 'viewer');
      if (userProfile !== null) {
        setCachedProfile(currentUser.id, userProfile, adminStatus);
      }
      lastLoadedUserId.current = currentUser.id;
    } catch (error) {
      console.error('[AuthProvider] 💥 EXCEPTION loading profile:', error);
      setProfile(null);
      setRole(null);
      setIsAdmin(false);
      setIsViewer(false);
    } finally {
      isLoadingProfile.current = false;
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
        // Fire-and-forget profile load so Auth UI is not blocked
        void loadProfile(initialSession?.user ?? null);
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
        
        // Only reload profile for actual auth changes, not initial session.
        // Force a fresh DB fetch on SIGNED_IN so a stale cache never hides
        // the correct role after the user logs in.
        const shouldReloadProfile = event !== 'INITIAL_SESSION';
        const forceRefresh = event === 'SIGNED_IN';
        
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        
        if (shouldReloadProfile) {
          // Fire-and-forget so auth UI is never blocked on DB latency
          void loadProfile(currentSession?.user ?? null, forceRefresh);
        }
        
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
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (!error && data.user) {
        void logEvent({ action: 'login', module: 'auth', details: `${email} signed in` });
      }
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
      clearCachedProfile();
      lastLoadedUserId.current = null;
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
      await loadProfile(user, true); // Force refresh
    }
  };

  const value: AuthContextType = {
    user,
    session,
    profile,
    role,
    isAdmin,
    isViewer,
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
