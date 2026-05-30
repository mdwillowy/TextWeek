import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import api, { configureAuthInterceptor, setAuthToken } from '../api/axios';
import { connectSocket, disconnectSocket, getSocket, updateSocketToken } from '../socket/socketClient';
import { getPublicKeyBundleForUpload } from '../services/e2eeService';
import { putMyKeyBundle } from '../api/keys';

const AuthContext = createContext(null);
const TOKEN_KEY = 'textweek_access_token';
const SESSION_HINT_KEY = 'textweek_has_session';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const bootstrapInFlightRef = useRef(false);
  const isAuthenticated = Boolean(user && accessToken);

  const applyToken = useCallback((token) => {
    setAccessToken(token || null);
    setAuthToken(token || null);
    if (token) {
      sessionStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(SESSION_HINT_KEY, '1');
    } else {
      sessionStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(SESSION_HINT_KEY);
    }
  }, []);

  const fetchMe = useCallback(async () => {
    const response = await api.get('/auth/me');
    setUser(response.data.data.user);
  }, []);

  const refreshAccess = useCallback(async () => {
    const response = await api.post('/auth/refresh', {});
    const nextToken = response?.data?.data?.accessToken;
    if (!nextToken) {
      throw new Error('No access token returned');
    }
    applyToken(nextToken);
    return nextToken;
  }, [applyToken]);

  useEffect(() => {
    configureAuthInterceptor({
      onNewAccessToken: (token) => applyToken(token),
      onAuthFailure: () => {
        applyToken(null);
        setUser(null);
      },
    });
  }, [applyToken]);

  useEffect(() => {
    async function bootstrap() {
      if (bootstrapInFlightRef.current) {
        return;
      }

      bootstrapInFlightRef.current = true;
      const savedToken = sessionStorage.getItem(TOKEN_KEY);
      const hasSessionHint = localStorage.getItem(SESSION_HINT_KEY) === '1';

      try {
        if (savedToken) {
          applyToken(savedToken);
          await fetchMe();
          return;
        }

        if (!hasSessionHint) {
          applyToken(null);
          setUser(null);
          return;
        }

        await refreshAccess();
        await fetchMe();
      } catch {
        if (!savedToken) {
          applyToken(null);
          setUser(null);
          return;
        }

        try {
          await refreshAccess();
          await fetchMe();
        } catch {
          applyToken(null);
          setUser(null);
        }
      } finally {
        bootstrapInFlightRef.current = false;
        setIsLoading(false);
      }
    }

    bootstrap();
  }, [applyToken, fetchMe, refreshAccess]);

  const login = useCallback(
    async (payload) => {
      const response = await api.post('/auth/login', payload);
      const nextToken = response.data.data.accessToken;
      applyToken(nextToken);
      setUser(response.data.data.user);
      return response.data;
    },
    [applyToken]
  );

  const signup = useCallback(
    async (payload) => {
      const response = await api.post('/auth/signup', payload);
      const nextToken = response.data.data.accessToken;
      applyToken(nextToken);
      setUser(response.data.data.user);
      return response.data;
    },
    [applyToken]
  );

  const refreshMe = useCallback(async () => {
    await fetchMe();
  }, [fetchMe]);

  const logout = useCallback(async () => {
    applyToken(null);
    setUser(null);
    disconnectSocket();

    try {
      await api.post('/auth/logout');
    } catch {
      // Local logout state is already applied; server logout is best-effort.
    }
  }, [applyToken]);

  const logoutAll = useCallback(async () => {
    applyToken(null);
    setUser(null);
    disconnectSocket();

    try {
      await api.post('/auth/logout-all');
    } catch {
      // Local logout state is already applied; server logout is best-effort.
    }
  }, [applyToken]);

  const value = useMemo(
    () => ({
      user,
      accessToken,
      isAuthenticated,
      isLoading,
      login,
      signup,
      logout,
      logoutAll,
      refreshMe,
      setUser,
    }),
    [user, accessToken, isAuthenticated, isLoading, login, signup, logout, logoutAll, refreshMe]
  );

  useEffect(() => {
    if (accessToken) {
      updateSocketToken(accessToken);
      connectSocket(accessToken);
      return;
    }

    disconnectSocket();
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) return undefined;

    const timer = setInterval(() => {
      const socket = getSocket();
      if (socket?.connected) {
        socket.emit('presence:heartbeat', {});
      }
    }, 20000);

    return () => clearInterval(timer);
  }, [accessToken]);

  useEffect(() => {
    if (!isAuthenticated) return;

    let isMounted = true;

    async function syncKeyBundle() {
      try {
        const bundle = await getPublicKeyBundleForUpload();
        if (!isMounted) return;
        await putMyKeyBundle(bundle);
      } catch {
        // Key sync is best-effort scaffolding and should not block app usage.
      }
    }

    syncKeyBundle();

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated]);

  useEffect(() => {
    const selected = user?.settings?.theme || 'system';
    if (selected === 'system') {
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.body.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
      return;
    }

    document.body.setAttribute('data-theme', selected);
  }, [user?.settings?.theme]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
