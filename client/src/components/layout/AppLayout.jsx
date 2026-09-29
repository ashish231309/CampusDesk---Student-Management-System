import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';

import { Sidebar } from './Sidebar.jsx';
import { Topbar } from './Topbar.jsx';
import { appConfig } from '../../config/app.js';

/**
 * Application shell for every signed-in page: fixed rail on desktop, drawer on
 * mobile, sticky top bar and a scrollable content area.
 */
export const AppLayout = () => {
  const { pathname } = useLocation();

  /**
   * The drawer remembers the route it was opened from, so navigating away
   * closes it without an effect that resets state on every route change.
   */
  const [drawerRoute, setDrawerRoute] = useState(null);
  const isNavigationOpen = drawerRoute === pathname;

  return (
    <div className="min-h-dvh bg-canvas">
      <Sidebar isOpen={isNavigationOpen} onClose={() => setDrawerRoute(null)} />

      <div className="lg:pl-[264px]">
        <Topbar onOpenNavigation={() => setDrawerRoute(pathname)} />

        <main id="main-content" className="mx-auto w-full max-w-[1320px] px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>

        <footer className="mx-auto w-full max-w-[1320px] px-4 pb-8 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-1 border-t border-line/60 pt-4 text-[12px] text-muted sm:flex-row sm:items-center sm:justify-between">
            <p>
              {appConfig.name} · {appConfig.tagline}
            </p>
            <p>© {appConfig.year} Ashish Kumar</p>
          </div>
        </footer>
      </div>
    </div>
  );
};
