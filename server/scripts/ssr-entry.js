/**
 * Entry point for the route-rendering checks in `verify.js`.
 *
 * It is plain JavaScript rather than JSX so the server's lint rules can read it,
 * and it is only ever *bundled*: `verify.js` builds it with the same bundler Vite
 * uses, supplies a stub for `import.meta.env` and runs the result in Node.
 * Nothing else imports this file.
 *
 * Two exports, because there are two questions worth asking without a browser:
 * which screen a URL produces for a real visitor (`renderRoute`), and what a
 * signed-in screen looks like once the session is known (`renderSignedIn`).
 */
import { createElement as h } from 'react';
import { renderToReadableStream } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';

import { AppLayout } from '../../client/src/components/layout/AppLayout.jsx';
import { AuthProvider } from '../../client/src/context/AuthProvider.jsx';
import { AuthContext } from '../../client/src/context/authContext.js';
import { ToastProvider } from '../../client/src/context/ToastProvider.jsx';
import DashboardPage from '../../client/src/pages/DashboardPage.jsx';
import StudentDetailPage from '../../client/src/pages/StudentDetailPage.jsx';
import StudentFormPage from '../../client/src/pages/StudentFormPage.jsx';
import StudentsPage from '../../client/src/pages/StudentsPage.jsx';
import { AppRoutes } from '../../client/src/routes/AppRoutes.jsx';

const renderNode = async (node) => {
  const stream = await renderToReadableStream(node);
  await stream.allReady;
  return new Response(stream).text();
};

/** The whole application, as a browser would see it on a first render. */
export const renderRoute = (url) =>
  renderNode(
    h(
      MemoryRouter,
      { initialEntries: [url] },
      h(ToastProvider, null, h(AuthProvider, null, h(AppRoutes))),
    ),
  );

/**
 * A resolved session, so the signed-in screen can be rendered without a network.
 * This is a stand-in for `AuthProvider`'s own state, never something the
 * application itself can be given — and it is only ever passed in here.
 */
const RESOLVED_SESSION = {
  status: 'authenticated',
  isLoading: false,
  isAuthenticated: true,
  user: { name: 'Ananya Sharma', email: 'ananya@campusdesk.edu', role: 'staff' },
  login: async () => {},
  register: async () => {},
  logout: async () => {},
};

const PAGES = {
  dashboard: DashboardPage,
  students: StudentsPage,
  detail: StudentDetailPage,
};

export const renderSignedIn = (url, page = 'students') =>
  renderNode(
    h(
      MemoryRouter,
      { initialEntries: [url] },
      h(
        ToastProvider,
        null,
        h(
          AuthContext.Provider,
          { value: RESOLVED_SESSION },
          h(
            AppLayout,
            null,
            page === 'form' ? h(StudentFormPage, { mode: 'create' }) : h(PAGES[page] ?? StudentsPage),
          ),
        ),
      ),
    ),
  );
