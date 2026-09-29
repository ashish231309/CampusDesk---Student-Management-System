import { Link, useLocation } from 'react-router-dom';
import { Menu, Plus } from 'lucide-react';

import { UserMenu } from './UserMenu.jsx';
import { IconButton } from '../ui/Button.jsx';
import { buttonClasses } from '../ui/buttonStyles.js';
import { SAMPLE_DATA_IN_USE } from '../../data/sampleStudents.js';
import { navigationItems } from '../../config/navigation.js';
import { paths } from '../../routes/paths.js';

export const Topbar = ({ onOpenNavigation }) => {
  const { pathname } = useLocation();

  const match = navigationItems.find((item) =>
    item.end ? pathname === item.to : pathname.startsWith(item.to),
  );

  const section = match?.label ?? (pathname.startsWith('/students') ? 'Students' : 'CampusDesk');

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
          <p className="text-[11px] font-semibold tracking-wider text-muted uppercase">
            CampusDesk
          </p>
          <h1 className="truncate text-[15px] leading-tight font-semibold text-ink">{section}</h1>
        </div>

        {SAMPLE_DATA_IN_USE ? (
          <span
            title="The signed-in views still read the design fixture; live API data lands in a later stage."
            className="hidden rounded-full border border-line bg-surface px-2.5 py-1 text-[11px] font-semibold text-muted sm:inline-flex"
          >
            Sample records
          </span>
        ) : null}

        <Link
          to={paths.newStudent}
          className={buttonClasses({ variant: 'primary', size: 'sm', className: 'hidden sm:inline-flex' })}
        >
          <Plus className="size-4" aria-hidden="true" />
          Add student
        </Link>

        <UserMenu />
      </div>
    </header>
  );
};
