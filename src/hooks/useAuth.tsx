import { useState, useEffect, useRef, createContext, useContext, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { isNative } from '@/lib/capacitor/platform';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    console.log('[Auth] Setting up auth listener');

    // Safety timeout - unblock UI if auth takes too long
    const safetyTimeout = setTimeout(() => {
      if (isMounted.current && loading) {
        console.warn('[Auth] Safety timeout reached - unblocking UI');
        setLoading(false);
      }
    }, 5000);

    // Listener for ONGOING auth changes — sync state immediately, no setTimeout race
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        if (!isMounted.current) return;
        console.log('[Auth] State change:', event, currentSession?.user?.email ?? 'no user');
        // Apply synchronously — setTimeout(0) caused state to overwrite signIn's manual set
        // and produced a brief null-user flicker that crashed downstream queries on Android.
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
      }
    );

    // INITIAL load — this controls loading state
    const initializeAuth = async () => {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (!isMounted.current) return;
        
        console.log('[Auth] Initial session:', currentSession?.user?.email ?? 'none');
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
      } catch (err) {
        console.error('[Auth] getSession error:', err);
      } finally {
        if (isMounted.current) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    return () => {
      isMounted.current = false;
      clearTimeout(safetyTimeout);
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string) => {
    const redirectUrl = `${window.location.origin}/`;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl
      }
    });
    return { error: error as Error | null };
  };

  const signIn = async (email: string, password: string) => {
    try {
      console.log('[Auth] Signing in:', email);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        console.error('[Auth] Sign in error:', error.message);
        return { error: error as Error | null };
      }
      
      // Immediately update state on successful login
      console.log('[Auth] Sign in success, updating state');
      if (data.session) {
        setSession(data.session);
        setUser(data.session.user);
      }
      return { error: null };
    } catch (err) {
      console.error('[Auth] Sign in crash:', err);
      return { error: err as Error };
    }
  };

  const signInWithGoogle = async () => {
    const redirectUrl = isNative
      ? 'com.mylifeos.app://callback'
      : `${window.location.origin}/dashboard`;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
      }
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    try {
      setUser(null);
      setSession(null);
      await supabase.auth.signOut();
      console.log('[Auth] Signed out');
    } catch (err) {
      console.error('[Auth] Sign out error:', err);
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
