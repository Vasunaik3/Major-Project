import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../services/api.js';

const AuthContext = createContext(null);

function readStoredSession() {
  try {
    const token = localStorage.getItem('smart-onion-token');
    const user = JSON.parse(localStorage.getItem('smart-onion-user') || 'null');
    return token && user ? { token, user } : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(readStoredSession);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(async () => {
    try {
      if (localStorage.getItem('smart-onion-token')) {
        await apiRequest('/auth/logout', { method: 'POST' });
      }
    } catch {
      // Always clear the local session; the API may be offline or the token may have expired.
    } finally {
      localStorage.removeItem('smart-onion-token');
      localStorage.removeItem('smart-onion-user');
      setSession(null);
    }
  }, []);

  useEffect(() => {
    if (!session?.token) {
      setLoading(false);
      return undefined;
    }
    let active = true;
    apiRequest('/auth/me').then(({ user }) => {
      if (!active) return;
      localStorage.setItem('smart-onion-user', JSON.stringify(user));
      setSession((current) => current ? { ...current, user } : current);
    }).catch(() => {
      if (active) logout();
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [logout, session?.token]);

  const establishSession = useCallback((data) => {
    localStorage.setItem('smart-onion-token', data.token);
    localStorage.setItem('smart-onion-user', JSON.stringify(data.user));
    setSession({ token: data.token, user: data.user });
    setLoading(false);
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await apiRequest('/auth/login', {
      auth: false,
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    establishSession(data);
  }, [establishSession]);

  const register = useCallback(async (name, email, password) => {
    const data = await apiRequest('/auth/register', {
      auth: false,
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
    establishSession(data);
  }, [establishSession]);

  const value = useMemo(() => ({ session, loading, login, register, logout }), [session, loading, login, register, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider.');
  return context;
}
