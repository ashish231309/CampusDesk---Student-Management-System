import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useAuth } from '../../context/authContext.js';
import { PageLoader } from '../ui/Spinner.jsx';
import { paths } from '../../routes/paths.js';

/**
 * Route guard for the signed-in area.
 *
 * While the session is being restored it renders a loader rather than
 * redirecting, which is what stops a page refresh from bouncing a signed-in
 * user to the login screen. The original destination is kept in router state so
 * signing in can return the visitor to where they were headed — the whole URL,
 * search and filters included — together with the reason the session ended, if
 * it ended mid-use and is worth explaining.
 */
export const ProtectedRoute = () => {
  const { isLoading, isAuthenticated, sessionEndedReason } = useAuth();
  const location = useLocation();

  if (isLoading) return <PageLoader label="Checking your session…" />;

  if (!isAuthenticated) {
    return (
      <Navigate
        to={paths.login}
        replace
        state={{ from: location, ...(sessionEndedReason ? { reason: sessionEndedReason } : {}) }}
      />
    );
  }

  return <Outlet />;
};
