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
 *
 * Both take a small options object so a scenario can be set up without a
 * network: `renderRoute` accepts the router state a guard would have passed (an
 * expired session, say), and `renderSignedIn` accepts the role the session
 * should have, because the student screens present themselves differently to
 * staff and to an administrator.
 */
import { createElement as h } from 'react';
import { renderToReadableStream } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

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
export const renderRoute = (url, { state } = {}) =>
  renderNode(
    h(
      MemoryRouter,
      { initialEntries: [state ? { pathname: url, state } : url] },
      h(ToastProvider, null, h(AuthProvider, null, h(AppRoutes))),
    ),
  );

/**
 * A resolved session, so the signed-in screen can be rendered without a network.
 * This is a stand-in for `AuthProvider`'s own state, never something the
 * application itself can be given — and it is only ever passed in here.
 */
const sessionFor = (role) => ({
  status: 'authenticated',
  isLoading: false,
  isAuthenticated: true,
  user: {
    name: 'Ananya Sharma',
    email: 'ananya@campusdesk.edu',
    role,
  },
  sessionEndedReason: null,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
});

const PAGES = {
  dashboard: DashboardPage,
  students: StudentsPage,
  detail: StudentDetailPage,
};

/**
 * The edit form needs the URL parameter the router would normally supply, so it
 * is rendered through a matched route rather than handed in directly. It only
 * ever reaches its loading state here — there is no network in this harness —
 * which is still enough to see how the screen presents itself.
 */
const EDIT_ROUTE = '/students/6502a1b2c3d4e5f60718293a/edit';

const screen = (page) => {
  if (page === 'form') return h(StudentFormPage, { mode: 'create' });
  if (page === 'edit') {
    return h(
      Routes,
      null,
      h(Route, { path: '/students/:id/edit', element: h(StudentFormPage, { mode: 'edit' }) }),
    );
  }
  return h(PAGES[page] ?? StudentsPage);
};

export const renderSignedIn = (url, page = 'students', { role = 'staff' } = {}) =>
  renderNode(
    h(
      MemoryRouter,
      { initialEntries: [page === 'edit' ? EDIT_ROUTE : url] },
      h(
        ToastProvider,
        null,
        h(
          AuthContext.Provider,
          { value: sessionFor(role) },
          h(AppLayout, null, screen(page)),
        ),
      ),
    ),
  );
