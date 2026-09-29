import { useLocation } from 'react-router-dom';

import { AppLayout } from '../layout/AppLayout.jsx';
import { PageLoader } from '../ui/Spinner.jsx';
import { useAuth } from '../../context/authContext.js';
import NotFoundPage from '../../pages/NotFoundPage.jsx';

/**
 * The catch-all route.
 *
 * A URL that matches nothing is answered according to who is asking: a visitor
 * who is not signed in gets the plain not-found screen, and a signed-in user
 * gets the same page inside the application shell, so the sidebar and the rest
 * of CampusDesk stay within reach. The guard is not duplicated — the shell is
 * simply not rendered until the session has been resolved, which is what stops
 * an authenticated page flashing at an anonymous visitor.
 */
export const NotFoundRoute = () => {
  const { pathname } = useLocation();
  const { isLoading, isAuthenticated } = useAuth();

  if (isLoading) return <PageLoader label="Checking your session…" />;

  if (!isAuthenticated) return <NotFoundPage />;

  // `key` restarts the shell's entry transition, exactly as a real route would.
  return (
    <AppLayout key={pathname}>
      <NotFoundPage variant="app" />
    </AppLayout>
  );
};
