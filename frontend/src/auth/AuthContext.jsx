import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, clearTokens, getAccessToken, setSessionExpiredHandler, setTokens } from '../api/client';

const AuthContext = createContext(null);

// 'loading' while we check for an existing session on first load, so ProtectedRoute doesn't
// flash the login page for a user who's actually already logged in.
export function AuthProvider({ children }) {
  const [status, setStatus] = useState('loading');
  const [user, setUser] = useState(null);

  const loadCurrentUser = useCallback(async () => {
    const me = await api.get('/auth/me');
    setUser(me);
    setStatus('authenticated');
  }, []);

  useEffect(() => {
    setSessionExpiredHandler(() => {
      setUser(null);
      setStatus('unauthenticated');
    });

    if (!getAccessToken()) {
      setStatus('unauthenticated');
      return;
    }

    loadCurrentUser().catch(() => {
      clearTokens();
      setStatus('unauthenticated');
    });
  }, [loadCurrentUser]);

  const login = useCallback(
    async (email, password) => {
      const result = await api.post('/auth/login', { email, password });
      setTokens(result);
      await loadCurrentUser();
    },
    [loadCurrentUser]
  );

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout', {});
    } catch {
      // Best-effort — the token might already be invalid. Clear local state regardless.
    }
    clearTokens();
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  const hasPermission = useCallback((code) => !!user?.permissions?.includes(code), [user]);

  const value = useMemo(
    () => ({ status, user, login, logout, hasPermission }),
    [status, user, login, logout, hasPermission]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
