import { createContext, useEffect, useState, useRef, ReactNode } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';
import { getUserProfileById, isAdminByUserId, syncRoleToJwtMetadata } from '@/services/userService';
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
  role: UserRole | null;
  isAdmin: boolean;
  timestamp: number;
}

// localStorage key — persists across tabs and page refreshes so a cached role
// is available even when the Supabase REST API is temporarily unreachable.
const PROFILE_CACHE_KEY = 'auth_profile_cache_v3';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// Max time to wait for a DB profile fetch before falling back to cache/JWT.
// Prevents the loading screen from hanging when Supabase is slow or paused.
const DB_FETCH_TIMEOUT_MS = 5000;

function withTimeout<T>(promise: Promise<T>, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), DB_FETCH_TIMEOUT_MS)),
  ]);
}

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
      const cached = localStorage.getItem(PROFILE_CACHE_KEY);
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

  const setCachedProfile = (userId: string, profile: UserProfile | null, isAdmin: boolean, role: UserRole | null) => {
    try {
      const data: CachedProfile = {
        userId,
        profile,
        role,
        isAdmin,
        timestamp: Date.now()
      };
      localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('[AuthProvider] ❌ Error writing cache:', error);
    }
  };

  const clearCachedProfile = () => {
    try {
      localStorage.removeItem(PROFILE_CACHE_KEY);
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

    // Try to use cached profile first (warm path — DB not needed)
    if (!force) {
      const cached = getCachedProfile(currentUser.id);
      if (cached) {
        setProfile(cached.profile);
        setRole(cached.role);
        setIsAdmin(cached.isAdmin);
        setIsViewer(cached.role === 'viewer');
        lastLoadedUserId.current = currentUser.id;
        return;
      }
    }

    // Set loading flag
    isLoadingProfile.current = true;

    try {
      console.log('[AuthProvider] 📡 Fetching profile from database...');

      const userId = currentUser.id;
      const [userProfile, adminStatus] = await Promise.all([
        withTimeout(getUserProfileById(userId), null),
        withTimeout(isAdminByUserId(userId), false),
      ]);

      // Determine the resolved role using a three-tier fallback:
      //  1. DB user_profiles row (authoritative)
      //  2. JWT app_metadata.role (seeded by createUser / updateUserProfile,
      //     available even when the REST API is offline)
      //  3. localStorage cache (populated by previous successful loads)
      let resolvedRole = (userProfile?.role ?? null) as UserRole | null;
      let resolvedAdmin = adminStatus;

      if (!resolvedRole) {
        // Tier 2: JWT app_metadata.role (set by createUser / updateUserProfile)
        const jwtRole = currentUser.app_metadata?.role as UserRole | undefined;
        if (jwtRole && (['admin', 'user', 'viewer'] as string[]).includes(jwtRole)) {
          console.log('[AuthProvider] ℹ️ DB unavailable — using JWT app_metadata.role:', jwtRole);
          resolvedRole = jwtRole;
          resolvedAdmin = jwtRole === 'admin';
        }
      }

      if (!resolvedRole) {
        // Tier 3: stale localStorage cache (ignore expiry — better than "Unknown")
        try {
          const raw = localStorage.getItem(PROFILE_CACHE_KEY);
          if (raw) {
            const stale: CachedProfile = JSON.parse(raw);
            if (stale.userId === currentUser.id && stale.role) {
              console.log('[AuthProvider] ⚠️ DB+JWT failed — using stale cached role:', stale.role);
              resolvedRole = stale.role;
              resolvedAdmin = stale.isAdmin;
            }
          }
        } catch {
          // ignore parse errors
        }
      }

      console.log('[AuthProvider] ✅ Profile loaded:', {
        hasProfile: !!userProfile,
        resolvedRole,
        isAdmin: resolvedAdmin,
      });

      setProfile(userProfile);
      setRole(resolvedRole);
      setIsAdmin(resolvedAdmin);
      setIsViewer(resolvedRole === 'viewer');

      if (userProfile !== null) {
        setCachedProfile(currentUser.id, userProfile, resolvedAdmin, resolvedRole);

        // One-time background sync: mirror role into app_metadata so the JWT
        // carries it as a fallback for future sessions when the DB is offline.
        if (!currentUser.app_metadata?.role) {
          void syncRoleToJwtMetadata(userId, userProfile.role);
        }
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

    const initializeAuth = async () => {
      try {
        console.log('[AuthProvider] 📡 Getting session from Supabase...');
        const { data: { session: initialSession } } = await supabase.auth.getSession();

        console.log('[AuthProvider] ✅ Session retrieved:', {
          hasSession: !!initialSession,
          hasUser: !!initialSession?.user,
          userEmail: initialSession?.user?.email,
        });

        setSession(initialSession);
        setUser(initialSession?.user ?? null);

        // Await the profile so role/isAdmin are committed before loading=false
        // clears the spinner. Without this the header renders with role=null
        // ("Unknown") and only corrects itself after the DB query completes.
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
          userEmail: currentSession?.user?.email,
        });

        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        if (event === 'INITIAL_SESSION') {
          // initializeAuth already awaits loadProfile and controls loading=false
          // for the initial session — nothing to do here.
          return;
        }

        if (event === 'SIGNED_OUT') {
          // State already cleared via setUser/setSession above; no loading needed.
          setLoading(false);
          return;
        }

        // TOKEN_REFRESHED / USER_UPDATED are background operations — the user
        // is already on a page and should NOT see the loading screen.
        // Refresh the profile silently without touching the loading flag.
        if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
          if (!isLoadingProfile.current) {
            void loadProfile(currentSession?.user ?? null, false);
          }
          return;
        }

        // SIGNED_IN: silently update profile in the background — no loading screen.
        //
        // Why: this event fires in three situations:
        //   1. A new browser tab detects the existing session.
        //   2. The user signs in from the login page (initializeAuth already
        //      handled the initial loading state; the listener just refreshes).
        //   3. Any other re-auth flow.
        //
        // In all cases the user is already on a page (or ProtectedRoute will
        // immediately render once setUser above commits). Showing loading=true
        // here flashes the full-screen spinner on every new tab and every login,
        // even when the profile is already cached in localStorage.
        if (event === 'SIGNED_IN' && !isLoadingProfile.current) {
          void loadProfile(currentSession?.user ?? null, false);
        }
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
