import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as authApi from '../api/auth';
import { clearTokens, getAccessToken, setSessionExpiredHandler, setTokens } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [status, setStatus] = useState('loading');
  const [profile, setProfile] = useState(null);

  const loadProfile = useCallback(async () => {
    const me = await authApi.getMe();
    setProfile(me);
    setStatus('authenticated');
  }, []);

  useEffect(() => {
    setSessionExpiredHandler(() => {
      setProfile(null);
      setStatus('unauthenticated');
    });

    if (!getAccessToken()) {
      setStatus('unauthenticated');
      return;
    }

    loadProfile().catch(() => {
      clearTokens();
      setStatus('unauthenticated');
    });
  }, [loadProfile]);

  const login = useCallback(
    async (email, password) => {
      const result = await authApi.login(email, password);
      setTokens(result);
      await loadProfile();
    },
    [loadProfile]
  );

  // Registration success already returns tokens directly (no separate login round-trip needed)
  // — the caller (RegisterPage) hands them here after a 201.
  const completeRegistration = useCallback(
    async (result) => {
      setTokens(result);
      await loadProfile();
    },
    [loadProfile]
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Best-effort — the token might already be invalid.
    }
    clearTokens();
    setProfile(null);
    setStatus('unauthenticated');
  }, []);

  const refreshProfile = useCallback(() => loadProfile(), [loadProfile]);

  const value = useMemo(
    () => ({ status, profile, login, completeRegistration, logout, refreshProfile }),
    [status, profile, login, completeRegistration, logout, refreshProfile]
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
