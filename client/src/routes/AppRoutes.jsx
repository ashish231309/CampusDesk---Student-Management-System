import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';

import { AppLayout } from '../components/layout/AppLayout.jsx';
import { ProtectedRoute } from '../components/routing/ProtectedRoute.jsx';
import { PageLoader } from '../components/ui/Spinner.jsx';
import { paths } from './paths.js';

// Pages are code-split so the first paint of the public page stays small.
const LandingPage = lazy(() => import('../pages/LandingPage.jsx'));
const LoginPage = lazy(() => import('../pages/LoginPage.jsx'));
const RegisterPage = lazy(() => import('../pages/RegisterPage.jsx'));
const DashboardPage = lazy(() => import('../pages/DashboardPage.jsx'));
const StudentsPage = lazy(() => import('../pages/StudentsPage.jsx'));
const StudentDetailPage = lazy(() => import('../pages/StudentDetailPage.jsx'));
const StudentFormPage = lazy(() => import('../pages/StudentFormPage.jsx'));
const NotFoundPage = lazy(() => import('../pages/NotFoundPage.jsx'));

export const AppRoutes = () => (
  <Suspense fallback={<PageLoader />}>
    <Routes>
      {/* Public */}
      <Route path={paths.home} element={<LandingPage />} />
      <Route path={paths.login} element={<LoginPage />} />
      <Route path={paths.register} element={<RegisterPage />} />

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

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  </Suspense>
);
