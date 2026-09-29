import { BrowserRouter } from 'react-router-dom';

import { AppRoutes } from './routes/AppRoutes.jsx';
import { AuthProvider } from './context/AuthProvider.jsx';
import { ToastProvider } from './context/ToastProvider.jsx';
import { ScrollToTop } from './components/routing/ScrollToTop.jsx';

/**
 * Provider order matters: notifications wrap the whole app, and authentication
 * sits inside them so a session failure can still raise a toast.
 */
export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <ScrollToTop />
          <AppRoutes />
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
