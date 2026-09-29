import { matchPath } from 'react-router-dom';

import { appConfig } from '../config/app.js';
import { notFound, paths } from './paths.js';

/**
 * What each URL in CampusDesk *is* — its document title, its label, whether it
 * belongs to the public site or the signed-in application, and which route it
 * sits under.
 *
 * It is deliberately plain data, not JSX: the router renders from `paths`, and
 * everything that is about a URL rather than about a screen lives here. Adding a
 * page means adding one line below and one line in the router.
 *
 * Order matters. The matcher walks the list and returns the first entry that
 * matches, and the catch-all is last — which is what lets the static
 * `/students/new` win over the dynamic `/students/:studentId`.
 */
export const routeMeta = [
  {
    path: paths.home,
    scope: 'public',
    label: 'Home',
    title: `${appConfig.name} — Student Management System`,
  },
  { path: paths.login, scope: 'public', label: 'Sign in', title: `Sign in · ${appConfig.name}` },
  {
    path: paths.register,
    scope: 'public',
    label: 'Create an account',
    title: `Create an account · ${appConfig.name}`,
  },

  {
    path: paths.dashboard,
    scope: 'protected',
    label: 'Dashboard',
    title: `Dashboard · ${appConfig.name}`,
  },
  {
    path: paths.students,
    scope: 'protected',
    label: 'Students',
    title: `Students · ${appConfig.name}`,
  },
  {
    path: paths.newStudent,
    scope: 'protected',
    label: 'Add student',
    parent: paths.students,
    title: `Add student · ${appConfig.name}`,
  },
  {
    path: paths.student(),
    scope: 'protected',
    label: 'Student',
    parent: paths.students,
    title: `Student · ${appConfig.name}`,
  },
  {
    path: paths.editStudent(),
    scope: 'protected',
    label: 'Edit student',
    parent: paths.student(),
    title: `Edit student · ${appConfig.name}`,
  },

  {
    path: notFound,
    scope: 'public',
    label: 'Not found',
    title: `Page not found · ${appConfig.name}`,
  },
];

const entryFor = (pattern) => routeMeta.find((entry) => entry.path === pattern);

/** Fills `/students/:studentId` with the params matched from a real URL. */
const fill = (pattern, params) =>
  pattern.replace(/:(\w+)/g, (segment, key) => params[key] ?? segment);

/**
 * The route a URL belongs to, with any params it captured. Every URL matches
 * something: the last entry is the catch-all, which is what makes the not-found
 * screen part of the same metadata rather than a special case in the router.
 */
export const matchRouteMeta = (pathname = paths.home) => {
  for (const entry of routeMeta) {
    const match = matchPath({ path: entry.path, end: true }, pathname);
    if (match) return { ...entry, params: match.params ?? {} };
  }

  return { ...entryFor(notFound), params: {} };
};

/** The document title for a URL, used by the shell and by the pages. */
export const routeTitle = (pathname) => matchRouteMeta(pathname).title;

/**
 * The trail *above* a route — `/students/42/edit` gives Students → this student.
 * Callers append their own last crumb, because it usually carries something the
 * URL cannot say, such as a student's name.
 */
export const routeCrumbs = (pathname) => {
  const route = matchRouteMeta(pathname);
  const crumbs = [];

  let parent = route.parent ? entryFor(route.parent) : null;
  while (parent) {
    crumbs.unshift({ label: parent.label, to: fill(parent.path, route.params) });
    parent = parent.parent ? entryFor(parent.parent) : null;
  }

  return crumbs;
};
