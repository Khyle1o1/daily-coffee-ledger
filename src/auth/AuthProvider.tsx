import { createContext, useEffect, useState, useRef, useCallback, ReactNode } from 'react';
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

  // Prevent React Strict Mode from running initialization twice.
  // The listener is always re-subscribed after cleanup, but getSession +
  // loadProfile should only ever run once per true mount.
  const initializedRef = useRef(false);

  // Tracks the user whose profile is currently loaded in state.
  // Checked before firing any loadProfile call to avoid redundant fetches.
  const lastLoadedUserId = useRef<string | null>(null);

  // Guards against concurrent profile fetch requests.
  const isLoadingProfile = useRef(false);

  // ─── Cache helpers ────────────────────────────────────────────────────────

  const getCachedProfile = (userId: string): CachedProfile | null => {
    try {
      const cached = localStorage.getItem(PROFILE_CACHE_KEY);
      if (!cached) return null;
      const data: CachedProfile = JSON.parse(cached);
      if (data.userId === userId && Date.now() - data.timestamp < CACHE_DURATION) {
        console.log('[AuthProvider] 💾 Using cached profile for', userId);
        return data;
      }
      return null;
    } catch (error) {
      console.error('[AuthProvider] ❌ Error reading cache:', error);
      return null;
    }
  };

  const setCachedProfile = (
    userId: string,
    cachedProfile: UserProfile | null,
    adminFlag: boolean,
    cachedRole: UserRole | null,
  ) => {
    try {
      const data: CachedProfile = { userId, profile: cachedProfile, role: cachedRole, isAdmin: adminFlag, timestamp: Date.now() };
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

  // ─── Profile loader ───────────────────────────────────────────────────────

  const loadProfile = useCallback(async (currentUser: User | null, force = false) => {
    if (!currentUser) {
      setProfile(null);
      setRole(null);
      setIsAdmin(false);
      setIsViewer(false);
      clearCachedProfile();
      lastLoadedUserId.current = null;
      return;
    }

    // Guard: concurrent load already in progress
    if (isLoadingProfile.current) {
      console.log('[AuthProvider] ⏭️ Profile load already in progress — skipping');
      return;
    }

    // Guard: same user already loaded and no force refresh requested
    if (!force && lastLoadedUserId.current === currentUser.id) {
      console.log('[AuthProvider] ⏭️ Profile already loaded for user', currentUser.id, '— skipping');
      return;
    }

    console.log('[AuthProvider] 👤 Loading profile for', currentUser.email);

    // Warm path: serve from cache without hitting the DB
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

    isLoadingProfile.current = true;

    try {
      console.log('[AuthProvider] 📡 Fetching profile from database...');

      const userId = currentUser.id;
      const [userProfile, adminStatus] = await Promise.all([
        withTimeout(getUserProfileById(userId), null),
        withTimeout(isAdminByUserId(userId), false),
      ]);

      // Three-tier role fallback:
      //  1. DB user_profiles row (authoritative)
      //  2. JWT app_metadata.role (available when DB is offline)
      //  3. Stale localStorage cache (better than showing "Unknown")
      let resolvedRole = (userProfile?.role ?? null) as UserRole | null;
      let resolvedAdmin = adminStatus;

      if (!resolvedRole) {
        const jwtRole = currentUser.app_metadata?.role as UserRole | undefined;
        if (jwtRole && (['admin', 'user', 'viewer'] as string[]).includes(jwtRole)) {
          console.log('[AuthProvider] ℹ️ DB unavailable — using JWT app_metadata.role:', jwtRole);
          resolvedRole = jwtRole;
          resolvedAdmin = jwtRole === 'admin';
        }
      }

      if (!resolvedRole) {
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

      console.log('[AuthProvider] ✅ Profile resolved:', { hasProfile: !!userProfile, resolvedRole, isAdmin: resolvedAdmin });

      setProfile(userProfile);
      setRole(resolvedRole);
      setIsAdmin(resolvedAdmin);
      setIsViewer(resolvedRole === 'viewer');

      if (userProfile !== null) {
        setCachedProfile(userId, userProfile, resolvedAdmin, resolvedRole);

        // One-time background sync: mirror role into JWT app_metadata so it
        // survives future sessions when the REST API is offline.
        if (!currentUser.app_metadata?.role) {
          void syncRoleToJwtMetadata(userId, userProfile.role);
        }
      }

      lastLoadedUserId.current = currentUser.id;
    } catch (error) {
      console.error('[AuthProvider] 💥 Exception loading profile:', error);
      setProfile(null);
      setRole(null);
      setIsAdmin(false);
      setIsViewer(false);
    } finally {
      isLoadingProfile.current = false;
    }
  }, []);

  // ─── Auth initialization ──────────────────────────────────────────────────

  useEffect(() => {
    // ── Step 1: one-time startup (getSession + loadProfile) ──────────────────
    //
    // The initializedRef prevents this block from running a second time during
    // React Strict Mode's deliberate double-mount in development. The listener
    // below is always re-subscribed after cleanup so auth events are never missed.
    const initializeAuth = async () => {
      if (initializedRef.current) {
        console.log('[AuthProvider] ⏭️ Already initialized — skipping duplicate startup');
        return;
      }
      initializedRef.current = true;

      console.log('[AuthProvider] 🚀 Auth initialization starting...');

      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();

        console.log('[AuthProvider] ✅ getSession complete:', {
          hasSession: !!initialSession,
          userEmail: initialSession?.user?.email ?? 'none',
        });

        setSession(initialSession);
        setUser(initialSession?.user ?? null);

        // Await profile so role/isAdmin are committed before the spinner clears.
        // Without this the header briefly renders with role=null ("Unknown").
        if (initialSession?.user) {
          await loadProfile(initialSession.user);
        }
      } catch (error) {
        console.error('[AuthProvider] ❌ Error during initialization:', error);
      } finally {
        console.log('[AuthProvider] ✅ Auth initialization complete — loading=false');
        setLoading(false);
      }
    };

    void initializeAuth();

    // ── Step 2: listener for post-init auth changes ───────────────────────────
    //
    // Rules:
    //  • INITIAL_SESSION — always ignored; getSession() already handled it.
    //  • SIGNED_IN       — ignored when the incoming user ID matches the already-
    //                      loaded user (duplicate event). Processed for real sign-ins
    //                      and account switches.
    //  • TOKEN_REFRESHED — session token rotated; no profile change needed.
    //  • USER_UPDATED    — user metadata changed; force-reload profile.
    //  • SIGNED_OUT      — clear all state.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        if (event === 'INITIAL_SESSION') {
          // getSession() in initializeAuth already handles the startup session.
          // Supabase fires this synchronously when the listener is registered —
          // processing it would duplicate the profile load.
          console.log('[AuthProvider] ⏭️ Ignoring INITIAL_SESSION (handled by getSession)');
          return;
        }

        if (event === 'SIGNED_OUT') {
          console.log('[AuthProvider] 🚪 User signed out — clearing state');
          setSession(null);
          setUser(null);
          setProfile(null);
          setRole(null);
          setIsAdmin(false);
          setIsViewer(false);
          clearCachedProfile();
          lastLoadedUserId.current = null;
          setLoading(false);
          return;
        }

        if (event === 'TOKEN_REFRESHED') {
          // Only the token changed — update session silently, no profile reload.
          console.log('[AuthProvider] 🔄 Token refreshed — session updated silently');
          setSession(currentSession);
          return;
        }

        if (event === 'USER_UPDATED') {
          console.log('[AuthProvider] 🔄 User updated — reloading profile');
          setSession(currentSession);
          setUser(currentSession?.user ?? null);
          void loadProfile(currentSession?.user ?? null, true);
          return;
        }

        if (event === 'SIGNED_IN') {
          const incomingId = currentSession?.user?.id ?? null;

          // Duplicate SIGNED_IN for the same user — ignore.
          // This fires on every new tab and on Strict Mode re-mount.
          if (incomingId && incomingId === lastLoadedUserId.current) {
            console.log('[AuthProvider] ⏭️ Ignoring duplicate SIGNED_IN — same user already loaded');
            return;
          }

          // Real sign-in or account switch — update state and load profile.
          console.log('[AuthProvider] 🔔 SIGNED_IN — new or switched user, loading profile');
          setSession(currentSession);
          setUser(currentSession?.user ?? null);
          void loadProfile(currentSession?.user ?? null);
        }
      }
    );

    return () => {
      console.log('[AuthProvider] 🔌 Unsubscribing auth listener');
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  // ─── Auth actions ─────────────────────────────────────────────────────────

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
      const { error } = await supabase.auth.signUp({ email, password });
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
      console.error('[AuthProvider] Error signing out:', error);
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
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      return { error };
    } catch (error) {
      return { error: error as AuthError };
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await loadProfile(user, true);
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
