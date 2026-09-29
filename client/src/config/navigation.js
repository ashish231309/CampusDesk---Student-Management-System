import { LayoutDashboard, UserPlus, Users } from 'lucide-react';
import { paths } from '../routes/paths.js';

/**
 * Sidebar navigation. Grouped so the list still reads well once the later
 * stages add courses, reports and settings.
 */
export const navigationGroups = [
  {
    label: 'Overview',
    items: [{ to: paths.dashboard, label: 'Dashboard', icon: LayoutDashboard, end: true }],
  },
  {
    label: 'Records',
    items: [
      { to: paths.students, label: 'Students', icon: Users, end: true },
      { to: paths.newStudent, label: 'Add student', icon: UserPlus },
    ],
  },
];

/** Flattened lookup used to title the top bar. */
export const navigationItems = navigationGroups.flatMap((group) => group.items);
