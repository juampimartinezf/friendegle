import { createContext, createElement, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, tokenStore, type Me } from '../services/api';
import { disconnectSocket } from '../services/socket';

const ANON_KEY = 'friendegle_anon';

interface AuthState {
  user: Me | null;
  isAnonymous: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { email: string; password: string; username: string; realName?: string; ref?: string; acceptTerms: true }) => Promise<void>;
  continueAnonymously: () => void;
  logout: () => void;
  setUser: (u: Me) => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null);
  // El modo anónimo dura solo la sesión del navegador
  const [isAnonymous, setIsAnonymous] = useState(() => sessionStorage.getItem(ANON_KEY) === '1');
  const [loading, setLoading] = useState(!!tokenStore.get());

  useEffect(() => {
    if (!tokenStore.get()) return;
    api
      .me()
      .then(({ user }) => setUser(user))
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false));
  }, []);

  const onAuthed = useCallback(({ token, user }: { token: string; user: Me }) => {
    tokenStore.set(token);
    sessionStorage.removeItem(ANON_KEY);
    disconnectSocket();
    setIsAnonymous(false);
    setUser(user);
  }, []);

  const value: AuthState = {
    user,
    isAnonymous,
    loading,
    login: async (email, password) => onAuthed(await api.login({ email, password })),
    register: async (data) => onAuthed(await api.register(data)),
    continueAnonymously: () => {
      tokenStore.clear();
      disconnectSocket();
      sessionStorage.setItem(ANON_KEY, '1');
      setUser(null);
      setIsAnonymous(true);
    },
    logout: () => {
      tokenStore.clear();
      sessionStorage.removeItem(ANON_KEY);
      disconnectSocket();
      setUser(null);
      setIsAnonymous(false);
    },
    setUser,
  };

  return createElement(AuthContext.Provider, { value }, children);
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
