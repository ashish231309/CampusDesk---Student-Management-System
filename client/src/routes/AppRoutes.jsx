import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';

import { AppLayout } from '../components/layout/AppLayout.jsx';
import { PublicLayout } from '../components/layout/PublicLayout.jsx';
import { NotFoundRoute } from '../components/routing/NotFoundRoute.jsx';
import { ProtectedRoute } from '../components/routing/ProtectedRoute.jsx';
import { PageLoader } from '../components/ui/Spinner.jsx';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { paths } from './paths.js';

// Pages are code-split so the first paint of the public page stays small. The
// not-found screen is loaded eagerly: a broken URL must never wait on a chunk.
const LandingPage = lazy(() => import('../pages/LandingPage.jsx'));
const LoginPage = lazy(() => import('../pages/LoginPage.jsx'));
const RegisterPage = lazy(() => import('../pages/RegisterPage.jsx'));
const DashboardPage = lazy(() => import('../pages/DashboardPage.jsx'));
const StudentsPage = lazy(() => import('../pages/StudentsPage.jsx'));
const StudentDetailPage = lazy(() => import('../pages/StudentDetailPage.jsx'));
const StudentFormPage = lazy(() => import('../pages/StudentFormPage.jsx'));

/**
 * The route table.
 *
 * Three groups, read top to bottom: the public site, the signed-in application
 * behind `ProtectedRoute`, and one catch-all that answers every URL neither
 * group claimed. Layouts are attached to pathless routes so a page never has to
 * know which shell it is drawn in.
 */
export const AppRoutes = () => {
  useDocumentTitle();

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public site */}
        <Route path={paths.home} element={<LandingPage />} />

        <Route element={<PublicLayout />}>
          <Route path={paths.login} element={<LoginPage />} />
          <Route path={paths.register} element={<RegisterPage />} />
        </Route>

        {/* Signed-in area */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path={paths.dashboard} element={<DashboardPage />} />
            <Route path={paths.students} element={<StudentsPage />} />
            <Route path={paths.newStudent} element={<StudentFormPage mode="create" />} />
            <Route path={paths.editStudent()} element={<StudentFormPage mode="edit" />} />
            <Route path={paths.student()} element={<StudentDetailPage />} />
          </Route>
        </Route>

        {/* Anything else — the screen depends on whether a session exists */}
        <Route path="*" element={<NotFoundRoute />} />
      </Routes>
    </Suspense>
  );
};
