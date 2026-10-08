import { useCallback, useEffect, useState } from 'react';
import type { AuthUser } from '@workspace/api-client-react';

export type { AuthUser };

export interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (userId?: string) => void;
  logout: () => void;
  switchUser: (userId: string) => Promise<AuthUser | null>;
  refetchUser: () => Promise<void>;
}

function getBasePath() {
  return import.meta.env.BASE_URL.replace(/\/+$/, '') || '/';
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/user', { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { user: AuthUser | null };
      setUser(data.user ?? null);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const switchUser = useCallback(async (userId: string) => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user ?? null);
        setIsLoading(false);
        return data.user as AuthUser;
      }
    } catch (e) {
      console.error('Failed to switch user', e);
    }
    setIsLoading(false);
    return null;
  }, []);

  const login = useCallback((userId?: string) => {
    const base = getBasePath();
    const query = userId ? `?userId=${encodeURIComponent(userId)}&returnTo=${encodeURIComponent(base)}` : `?returnTo=${encodeURIComponent(base)}`;
    window.location.href = `/api/login${query}`;
  }, []);

  const logout = useCallback(() => {
    const base = getBasePath();
    window.location.href = `/api/logout?returnTo=${encodeURIComponent(base)}`;
  }, []);

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
    switchUser,
    refetchUser: fetchUser,
  };
}
