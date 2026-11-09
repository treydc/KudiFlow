import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import {
  getSupabase,
  isSupabaseConfigured,
  resetSupabaseClient,
  getSupabaseCredentials,
  DemoUser
} from '../lib/supabase';

interface AuthContextType {
  user: User | DemoUser | null;
  session: Session | null;
  loading: boolean;
  isConfigured: boolean;
  credentials: { url: string; anonKey: string };
  signIn: (email: string, password: string) => Promise<{ error: AuthError | Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: AuthError | Error | null; message?: string }>;
  signOut: () => Promise<void>;
  signInWithDemo: (demoEmail?: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEMO_STORAGE_KEY = 'kudiflow_demo_session';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | DemoUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isConfigured, setIsConfigured] = useState<boolean>(isSupabaseConfigured());
  const [credentials, setCredentials] = useState(getSupabaseCredentials());

  // Check initial session
  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      setLoading(true);
      const configured = isSupabaseConfigured();
      setIsConfigured(configured);
      setCredentials(getSupabaseCredentials());

      if (configured) {
        const client = getSupabase();
        if (client) {
          try {
            const { data: userData, error: userError } = await client.auth.getUser();
            if (!userError && userData?.user && mounted) {
              const { data: sessionData } = await client.auth.getSession();
              setSession(sessionData?.session || null);
              setUser(userData.user);
              setLoading(false);
              return;
            }
          } catch (e) {
            console.warn('Error reading Supabase session:', e);
          }
        }
      }

      // If no Supabase session or not configured, check for demo session in localStorage
      const savedDemo = localStorage.getItem(DEMO_STORAGE_KEY);
      if (savedDemo && mounted) {
        try {
          const parsed = JSON.parse(savedDemo);
          setUser(parsed);
        } catch {
          localStorage.removeItem(DEMO_STORAGE_KEY);
        }
      }

      if (mounted) {
        setLoading(false);
      }
    }

    initAuth();

    // Listen to Supabase auth events if configured
    let subscription: { unsubscribe: () => void } | null = null;
    const client = getSupabase();
    if (client) {
      const { data } = client.auth.onAuthStateChange((_event, newSession) => {
        if (!mounted) return;
        setSession(newSession);
        if (newSession?.user) {
          setUser(newSession.user);
          localStorage.removeItem(DEMO_STORAGE_KEY);
        } else {
          // If signed out of supabase, only clear if we aren't using a demo session
          const savedDemo = localStorage.getItem(DEMO_STORAGE_KEY);
          if (!savedDemo) {
            setUser(null);
          }
        }
      });
      subscription = data.subscription;
    }

    return () => {
      mounted = false;
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [isConfigured]);

  const signIn = useCallback(async (email: string, password: string): Promise<{ error: AuthError | Error | null }> => {
    if (!isConfigured) {
      // If not configured, provide a simulated sign-in or prompt
      if (!email || !password) {
        return { error: new Error('Please enter both email and password.') };
      }
      const demoUser: DemoUser = {
        id: 'demo-' + Math.random().toString(36).substring(2, 9),
        email: email.trim().toLowerCase(),
        created_at: new Date().toISOString(),
      };
      localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(demoUser));
      setUser(demoUser);
      return { error: null };
    }

    const client = getSupabase();
    if (!client) {
      return { error: new Error("Couldn't sign in. Please try again.") };
    }

    try {
      const { data, error } = await client.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        return { error };
      }

      setSession(data.session);
      setUser(data.user);
      localStorage.removeItem(DEMO_STORAGE_KEY);
      return { error: null };
    } catch (err) {
      return { error: err as Error };
    }
  }, [isConfigured]);

  const signUp = useCallback(async (email: string, password: string): Promise<{ error: AuthError | Error | null; message?: string }> => {
    if (!isConfigured) {
      if (!email || !password) {
        return { error: new Error('Please provide an email and password.') };
      }
      if (password.length < 6) {
        return { error: new Error('Password must be at least 6 characters.') };
      }
      const demoUser: DemoUser = {
        id: 'demo-' + Math.random().toString(36).substring(2, 9),
        email: email.trim().toLowerCase(),
        created_at: new Date().toISOString(),
      };
      localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(demoUser));
      setUser(demoUser);
      return { error: null, message: 'Account created! Welcome to KudiFlow.' };
    }

    const client = getSupabase();
    if (!client) {
      return { error: new Error("Couldn't create account. Please try again.") };
    }

    try {
      const { data, error } = await client.auth.signUp({
        email: email.trim(),
        password,
      });

      if (error) {
        return { error };
      }

      if (data.user && !data.session) {
        return {
          error: null,
          message: 'Account created! Please check your inbox to confirm your email.'
        };
      }

      setSession(data.session);
      setUser(data.user);
      localStorage.removeItem(DEMO_STORAGE_KEY);
      return { error: null };
    } catch (err) {
      return { error: err as Error };
    }
  }, [isConfigured]);

  const signOut = useCallback(async () => {
    const client = getSupabase();
    if (client && isConfigured) {
      try {
        await client.auth.signOut();
      } catch (e) {
        console.warn('Supabase sign out error:', e);
      }
    }
    localStorage.removeItem(DEMO_STORAGE_KEY);
    setUser(null);
    setSession(null);
  }, [isConfigured]);

  const signInWithDemo = useCallback((demoEmail = 'finance@kudiflow.app') => {
    const demoUser: DemoUser = {
      id: 'demo-user-master',
      email: demoEmail,
      created_at: new Date().toISOString(),
    };
    localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(demoUser));
    setUser(demoUser);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        isConfigured,
        credentials,
        signIn,
        signUp,
        signOut,
        signInWithDemo,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
