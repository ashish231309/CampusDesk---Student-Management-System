import { Suspense, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';

import { Sidebar } from './Sidebar.jsx';
import { Topbar } from './Topbar.jsx';
import { PageTransition } from '../motion/PageTransition.jsx';
import { ContentLoader } from '../ui/Spinner.jsx';
import { appConfig } from '../../config/app.js';
import { matchRouteMeta } from '../../routes/routeMeta.js';

/**
 * Application shell for every signed-in page: fixed rail on desktop, drawer on
 * mobile, sticky top bar and a scrollable content area.
 *
 * The shell owns everything that is the same on every screen — the frame, the
 * skip link, the page entry transition and the wait for a code-split page — so a
 * page is only its own content. It also renders `children` when it is given
 * them, which lets the catch-all route show the not-found page inside the shell.
 */
export const AppLayout = ({ children }) => {
  const { pathname } = useLocation();

  /**
   * The drawer remembers the route it was opened from, so navigating away
   * closes it without an effect that resets state on every route change.
   */
  const [drawerRoute, setDrawerRoute] = useState(null);
  const isNavigationOpen = drawerRoute === pathname;

  // A drawer on top of the page must be dismissible from the keyboard.
  useEffect(() => {
    if (!isNavigationOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setDrawerRoute(null);
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isNavigationOpen]);

  /**
   * The transition is keyed by the route pattern rather than the whole URL, so
   * moving between two students (or between pages of the register) keeps the
   * screen it is on instead of replaying the entrance.
   */
  const routePattern = matchRouteMeta(pathname).path;

  return (
    <div className="min-h-dvh bg-canvas">
      <a
        href="#main-content"
        className="focus-ring sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-field focus:bg-surface focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-ink focus:shadow-raised"
      >
        Skip to content
      </a>

      <Sidebar isOpen={isNavigationOpen} onClose={() => setDrawerRoute(null)} />

      <div className="lg:pl-[264px]">
        <Topbar onOpenNavigation={() => setDrawerRoute(pathname)} />

        <main id="main-content" className="mx-auto w-full max-w-[1320px] px-4 py-6 sm:px-6 lg:px-8">
          <Suspense fallback={<ContentLoader />}>
            <PageTransition key={routePattern}>{children ?? <Outlet />}</PageTransition>
          </Suspense>
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
