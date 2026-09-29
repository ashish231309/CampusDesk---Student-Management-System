import { useCallback, useEffect, useMemo, useState } from 'react';

import { AuthContext } from './authContext.js';
import { authService } from '../services/authService.js';
import { authToken, onUnauthorized } from '../services/apiClient.js';

/**
 * The single source of truth for who is signed in.
 *
 * `status` is 'loading' while a stored token is being checked against
 * `/api/auth/me`, which is what stops a page refresh from bouncing a signed-in
 * user to the login screen. The server is the only thing that decides whether a
 * session is real — this provider just reflects its answers, and drops the
 * session the moment the API stops accepting the token.
 */
export const AuthProvider = ({ children }) => {
  const [status, setStatus] = useState(() => (authToken.get() ? 'loading' : 'anonymous'));
  const [user, setUser] = useState(null);

  /**
   * Why the last session ended, when that is worth telling the user about.
   *
   * A token the API has stopped accepting is otherwise indistinguishable from
   * simply being signed out: the guard redirects and the visitor is left guessing.
   * Recording the reason here lets the sign-in screen explain itself.
   */
  const [sessionEndedReason, setSessionEndedReason] = useState(null);

  const startSession = useCallback((data) => {
    authToken.set(data.token);
    setUser(data.user ?? null);
    setStatus('authenticated');
    setSessionEndedReason(null);
  }, []);

  const endSession = useCallback((reason = null) => {
    authToken.clear();
    setUser(null);
    setStatus('anonymous');
    setSessionEndedReason(reason);
  }, []);

  /** Restore the session once on mount; the token alone is not trusted. */
  useEffect(() => {
    if (!authToken.get()) return undefined;

    let active = true;

    authService
      .me()
      .then((data) => {
        if (!active) return;
        setUser(data?.user ?? null);
        setStatus('authenticated');
      })
      .catch(() => {
        if (!active) return;
        endSession();
      });

    return () => {
      active = false;
    };
  }, [endSession]);

  /**
   * An expired or rejected token anywhere in the app ends the session, and the
   * visitor is told why on the way back to the sign-in screen.
   */
  useEffect(
    () =>
      onUnauthorized(() => {
        setUser(null);
        setStatus('anonymous');
        setSessionEndedReason('expired');
      }),
    [],
  );

  const login = useCallback(
    async (credentials) => {
      const data = await authService.login(credentials);
      startSession(data);
      return data.user;
    },
    [startSession],
  );

  const register = useCallback(
    async (payload) => {
      const data = await authService.register(payload);
      startSession(data);
      return data.user;
    },
    [startSession],
  );

  /**
   * Signing out always succeeds locally: the token is discarded and the user is
   * cleared even if the API is unreachable, because a client that cannot reach
   * the server must still be able to end its own session.
   */
  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch {
      /* The session is local; a failed request must not trap the user. */
    } finally {
      endSession('signed-out');
    }
  }, [endSession]);

  const value = useMemo(
    () => ({
      status,
      isLoading: status === 'loading',
      isAuthenticated: status === 'authenticated',
      user,
      sessionEndedReason,
      login,
      register,
      logout,
    }),
    [login, logout, register, sessionEndedReason, status, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
