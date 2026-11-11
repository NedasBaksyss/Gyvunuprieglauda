import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { apiRequest } from '../lib/api.js';

const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [state, setState] = useState({ user: null, loading: true, error: '' });
  const revision = useRef(0);
  const refresh = useCallback(async (signal) => {
    const current = ++revision.current;
    setState((old) => ({ ...old, loading: true, error: '' }));
    try {
      const data = await apiRequest('/api/auth/me', { signal });
      if (current === revision.current) setState({ user: data.user, loading: false, error: '' });
    } catch (error) {
      if (!signal?.aborted && current === revision.current) setState({ user: null, loading: false, error: error.status === 401 ? '' : error.message });
    }
  }, []);
  useEffect(() => { const controller = new AbortController(); refresh(controller.signal); return () => { controller.abort(); revision.current++; }; }, [refresh]);
  useEffect(() => { const check = () => refresh(); window.addEventListener('shelter:session-check', check); return () => window.removeEventListener('shelter:session-check', check); }, [refresh]);
  async function login(credentials) {
    const current = ++revision.current;
    const data = await apiRequest('/api/auth/login', { method: 'POST', body: credentials });
    if (current === revision.current) setState({ user: data.user, loading: false, error: '' });
  }
  async function logout() {
    const current = ++revision.current;
    await apiRequest('/api/auth/logout', { method: 'POST' });
    if (current === revision.current) setState({ user: null, loading: false, error: '' });
  }
  return <AuthContext.Provider value={{ ...state, login, logout, refresh }}>{children}</AuthContext.Provider>;
}
export default function useAuth() { return useContext(AuthContext); }
