'use client';

import { useState, useEffect, useCallback } from 'react';

export interface AuthUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  country: string | null;
  emailValidated: boolean;
  role: string;
  subscription: {
    isActive: boolean;
    planName: string | null;
    endDate: string | null;
    daysRemaining: number;
  } | null;
}

export function useAuth() {
  const [state, setState] = useState<{
    user: AuthUser | null;
    loading: boolean;
  }>({ user: null, loading: true });

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      const data = await res.json();
      setState({ user: data.user, loading: false });
    } catch {
      setState({ user: null, loading: false });
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let mounted = true;

    (async () => {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include', signal: controller.signal });
        const data = await res.json();
        if (mounted) setState({ user: data.user, loading: false });
      } catch {
        if (mounted) setState({ user: null, loading: false });
      }
    })();

    return () => {
      mounted = false;
      controller.abort();
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      credentials: 'include',
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur de connexion');
    setState({ user: data.user, loading: false });
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });
    setState({ user: null, loading: false });
  }, []);

  const refresh = useCallback(() => {
    fetchUser();
  }, [fetchUser]);

  return {
    user: state.user,
    loading: state.loading,
    isAuthenticated: !!state.user,
    hasActiveSubscription: !!state.user?.subscription?.isActive,
    login,
    logout,
    refresh,
  };
}
