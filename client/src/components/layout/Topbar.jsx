import { Link, useLocation } from 'react-router-dom';
import { Menu, Plus } from 'lucide-react';

import { UserMenu } from './UserMenu.jsx';
import { IconButton } from '../ui/Button.jsx';
import { buttonClasses } from '../ui/buttonStyles.js';
import { appConfig } from '../../config/app.js';
import { matchRouteMeta } from '../../routes/routeMeta.js';
import { paths } from '../../routes/paths.js';

/**
 * The application header: where you are, what this screen is, and the two things
 * you might want from anywhere — adding a student and your account.
 *
 * The name comes from the route metadata, so a nested URL such as
 * `/students/42/edit` says what it is instead of falling back to the section
 * above it. On a phone the primary action keeps its icon and drops its label so
 * the bar never has to scroll sideways.
 */
export const Topbar = ({ onOpenNavigation }) => {
  const { pathname } = useLocation();
  const route = matchRouteMeta(pathname);

  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-canvas/85 backdrop-blur-md">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
        <IconButton
          icon={Menu}
          label="Open navigation"
          onClick={onOpenNavigation}
          className="lg:hidden"
        />

        <div className="min-w-0 flex-1">
          <p className="eyebrow">{appConfig.name}</p>
          <h1 className="truncate text-subheading leading-tight font-semibold text-ink">
            {route.label ?? appConfig.name}
          </h1>
        </div>

        <Link
          to={paths.newStudent}
          aria-label="Add student"
          className={buttonClasses({
            variant: 'primary',
            size: 'sm',
            className: 'hidden sm:inline-flex',
          })}
        >
          <Plus className="size-4" aria-hidden="true" />
          Add student
        </Link>

        <Link
          to={paths.newStudent}
          aria-label="Add student"
          className={buttonClasses({ size: 'icon', className: 'size-9 sm:hidden' })}
        >
          <Plus className="size-4" aria-hidden="true" />
        </Link>

        <UserMenu />
      </div>
    </header>
  );
};
