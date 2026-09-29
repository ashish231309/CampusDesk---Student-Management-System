import { BrowserRouter } from 'react-router-dom';

import { AppRoutes } from './routes/AppRoutes.jsx';
import { AuthProvider } from './context/AuthProvider.jsx';
import { ToastProvider } from './context/ToastProvider.jsx';
import { ScrollToTop } from './components/routing/ScrollToTop.jsx';
import { RouteErrorBoundary } from './components/routing/AppErrorBoundary.jsx';

/**
 * Provider order matters.
 *
 * The router is outermost so the failure boundary and the notifications can both
 * navigate and link. The boundary sits inside the router but outside the
 * providers, so a crash in either provider is caught too, and it only depends on
 * the router — nothing that could itself have failed. Authentication sits inside
 * notifications so a session failure can still raise a toast.
 */
export default function App() {
  return (
    <BrowserRouter>
      <RouteErrorBoundary>
        <ToastProvider>
          <AuthProvider>
            <ScrollToTop />
            <AppRoutes />
          </AuthProvider>
        </ToastProvider>
      </RouteErrorBoundary>
    </BrowserRouter>
  );
}
