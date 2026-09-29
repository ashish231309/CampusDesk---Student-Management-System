import { LayoutDashboard, UserPlus, Users } from 'lucide-react';

import { paths } from '../routes/paths.js';

/**
 * Sidebar navigation. Grouped so the list still reads well once the later
 * stages add courses, reports and settings.
 *
 * Each item says how it should light up: `exact` for a single screen, `section`
 * for one that owns everything beneath it. The student routes are the reason
 * this is spelled out — `/students/42` should keep Students lit, while
 * `/students/new` has an item of its own and must not light both.
 */
export const navigationGroups = [
  {
    label: 'Overview',
    items: [
      { to: paths.dashboard, label: 'Dashboard', icon: LayoutDashboard, match: 'exact' },
    ],
  },
  {
    label: 'Records',
    items: [
      {
        to: paths.students,
        label: 'Students',
        icon: Users,
        match: 'section',
        except: [paths.newStudent],
      },
      { to: paths.newStudent, label: 'Add student', icon: UserPlus, match: 'exact' },
    ],
  },
];

/**
 * Route-aware active state for one item. `except` lists the routes that sit
 * under this one but have an item of their own, so exactly one item is ever lit.
 */
export const isNavigationItemActive = (item, pathname) => {
  if (item.match === 'exact') return pathname === item.to;
  if (item.except?.includes(pathname)) return false;

  return pathname === item.to || pathname.startsWith(`${item.to}/`);
};
