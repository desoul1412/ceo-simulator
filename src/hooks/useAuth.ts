/**
 * Auth hook — manages Supabase auth state on the client.
 * Stores JWT in localStorage, auto-refreshes, provides login/signup/logout.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase, isOnline } from '../lib/supabase';

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface AuthUser {
  id: string;
  email: string;
}

const STORAGE_KEY = 'ceo-sim-auth';

function loadSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveSession(session: AuthSession | null): void {
  if (session) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<AuthSession | null>(loadSession);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check if auth is available (Supabase connected + session exists)
  const authEnabled = isOnline() && supabase !== null;

  // Restore session on mount
  useEffect(() => {
    if (!authEnabled) {
      setLoading(false);
      return;
    }

    const stored = loadSession();
    if (!stored) {
      setLoading(false);
      return;
    }

    // Verify stored session
    supabase!.auth.getUser(stored.accessToken).then(({ data, error: err }) => {
      if (err || !data.user) {
        saveSession(null);
        setSession(null);
        setUser(null);
      } else {
        setUser({ id: data.user.id, email: data.user.email ?? '' });
        setSession(stored);
      }
      setLoading(false);
    });
  }, [authEnabled]);

  const login = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error('Supabase not configured');
    setError(null);

    const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) {
      setError(err.message);
      throw err;
    }

    const newSession: AuthSession = {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresAt: data.session.expires_at ?? 0,
    };
    saveSession(newSession);
    setSession(newSession);
    setUser({ id: data.user.id, email: data.user.email ?? '' });
  }, []);

  const signup = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error('Supabase not configured');
    setError(null);

    const { data, error: err } = await supabase.auth.signUp({ email, password });
    if (err) {
      setError(err.message);
      throw err;
    }

    if (data.session) {
      const newSession: AuthSession = {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresAt: data.session.expires_at ?? 0,
      };
      saveSession(newSession);
      setSession(newSession);
      setUser({ id: data.user!.id, email: data.user!.email ?? '' });
    }
  }, []);

  const logout = useCallback(async () => {
    if (supabase) {
      await supabase.auth.signOut().catch(() => {});
    }
    saveSession(null);
    setSession(null);
    setUser(null);
    setError(null);
  }, []);

  return {
    user,
    session,
    loading,
    error,
    authEnabled,
    isAuthenticated: !!user,
    login,
    signup,
    logout,
    accessToken: session?.accessToken ?? null,
  };
}
