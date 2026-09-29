import { createContext, useContext } from 'react';

export const AuthContext = createContext(null);

/**
 * Authentication state for the whole app.
 * `status` is 'loading' while the session is being restored, which is what the
 * protected routes wait for before deciding to redirect.
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>.');
  return context;
};
