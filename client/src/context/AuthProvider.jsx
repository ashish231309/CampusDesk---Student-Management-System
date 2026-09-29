import { useCallback, useEffect, useMemo, useState } from 'react';

import { AuthContext } from './authContext.js';
import { appConfig } from '../config/app.js';
import { authService } from '../services/authService.js';
import { authToken } from '../services/apiClient.js';

/**
 * The stand-in identity used by the development preview session. It is only
 * ever set when `appConfig.previewSession` is true (development builds), so a
 * production bundle can never end up authenticated by accident.
 */
const PREVIEW_USER = {
  id: 'preview',
  name: 'Campus Administrator',
  email: 'admin@campusdesk.edu',
  role: 'admin',
};

/**
 * A stored token means the session has to be verified before it can be trusted;
 * without one there is nothing to wait for, so the first render already knows
 * whether the visitor is anonymous or in a development preview session.
 */
const storedToken = authToken.get();
const startsInPreview = !storedToken && appConfig.previewSession;

export const AuthProvider = ({ children }) => {
  const [status, setStatus] = useState(() => {
    if (storedToken) return 'loading';
    return startsInPreview ? 'authenticated' : 'anonymous';
  });
  const [user, setUser] = useState(() => (startsInPreview ? PREVIEW_USER : null));
  const [isPreview, setIsPreview] = useState(startsInPreview);

  const enterPreview = useCallback(() => {
    setUser(PREVIEW_USER);
    setIsPreview(true);
    setStatus('authenticated');
  }, []);

  /** Verify a stored token once, then fall back to the preview session. */
  useEffect(() => {
    if (!storedToken) return undefined;

    let active = true;

    authService
      .me()
      .then((data) => {
        if (!active) return;
        setUser(data?.user ?? null);
        setIsPreview(false);
        setStatus('authenticated');
      })
      .catch(() => {
        if (!active) return;
        authToken.clear();
        if (appConfig.previewSession) enterPreview();
        else setStatus('anonymous');
      });

    return () => {
      active = false;
    };
  }, [enterPreview]);

  const login = useCallback(async (credentials) => {
    const data = await authService.login(credentials);
    authToken.set(data.token);
    setUser(data.user);
    setIsPreview(false);
    setStatus('authenticated');
    return data.user;
  }, []);

  const register = useCallback(async (payload) => {
    const data = await authService.register(payload);
    authToken.set(data.token);
    setUser(data.user);
    setIsPreview(false);
    setStatus('authenticated');
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      if (!isPreview) await authService.logout();
    } finally {
      authToken.clear();
      setUser(null);
      setIsPreview(false);
      setStatus('anonymous');
    }
  }, [isPreview]);

  const value = useMemo(
    () => ({
      status,
      isLoading: status === 'loading',
      isAuthenticated: status === 'authenticated',
      isPreview,
      isPreviewAvailable: appConfig.previewSession,
      user,
      login,
      register,
      logout,
      enterPreview,
    }),
    [enterPreview, isPreview, login, logout, register, status, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
