import { Link, useLocation } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import { GraduationCap, X } from 'lucide-react';

import { Logo } from '../branding/Logo.jsx';
import { IconButton } from '../ui/Button.jsx';
import { buttonClasses } from '../ui/buttonStyles.js';
import { isNavigationItemActive, navigationGroups } from '../../config/navigation.js';
import { appConfig } from '../../config/app.js';
import { paths } from '../../routes/paths.js';
import { cx } from '../../utils/cx.js';

/**
 * One navigation link. Active state comes from the shared rule in
 * `config/navigation.js` rather than from the router's own prefix matching, so
 * styling and `aria-current` always agree and nested student routes behave.
 *
 * The active treatment is a beige field plus a charcoal marker on the left edge:
 * the marker survives greyscale printing and colour-blindness, where a tint
 * alone would not.
 */
const NavItem = ({ item, onNavigate, layoutGroup, pathname }) => {
  const isActive = isNavigationItemActive(item, pathname);

  return (
    <Link
      to={item.to}
      onClick={onNavigate}
      aria-current={isActive ? 'page' : undefined}
      className={cx(
        'focus-ring group relative flex h-11 items-center gap-3 rounded-field px-3 text-body font-medium transition-colors duration-150',
        isActive ? 'text-ink' : 'text-muted hover:bg-beige/35 hover:text-charcoal',
      )}
    >
      {isActive ? (
        <motion.span
          layoutId={`sidebar-active-${layoutGroup}`}
          className="absolute inset-0 -z-10 rounded-field bg-beige/70"
          transition={{ type: 'spring', stiffness: 420, damping: 34 }}
        />
      ) : null}

      {isActive ? (
        <span
          className="absolute top-1/2 -left-2 h-5 w-1 -translate-y-1/2 rounded-full bg-charcoal"
          aria-hidden="true"
        />
      ) : null}

      <item.icon
        className={cx('size-[18px] shrink-0', isActive ? 'text-charcoal' : 'text-muted')}
        aria-hidden="true"
      />
      {item.label}
    </Link>
  );
};

const SidebarContent = ({ onNavigate, layoutGroup, onClose, pathname }) => (
  <div className="flex h-full flex-col gap-7 px-4 py-5">
    <div className="flex items-center justify-between gap-2">
      <Link to={paths.dashboard} className="focus-ring rounded">
        <Logo tagline />
      </Link>
      {onClose ? <IconButton icon={X} label="Close navigation" onClick={onClose} /> : null}
    </div>

    <nav className="flex-1 space-y-6" aria-label="Main navigation">
      {navigationGroups.map((group) => (
        <div key={group.label}>
          <p className="eyebrow px-3 pb-2">{group.label}</p>

          <ul className="space-y-1">
            {group.items.map((item) => (
              <li key={item.to}>
                <NavItem
                  item={item}
                  onNavigate={onNavigate}
                  layoutGroup={layoutGroup}
                  pathname={pathname}
                />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>

    {/* The rail ends on the one thing every signed-in user needs next. */}
    <div className="rounded-panel border border-line/70 bg-surface-muted p-4">
      <span className="grid size-9 place-items-center rounded-chip bg-beige/70 text-charcoal">
        <GraduationCap className="size-[18px]" aria-hidden="true" />
      </span>

      <p className="mt-3 text-label leading-relaxed text-muted">
        Every record on the register is issued a CampusDesk ID and kept in one place.
      </p>

      <Link
        to={paths.newStudent}
        className={buttonClasses({ variant: 'soft', size: 'sm', className: 'mt-3.5 w-full' })}
      >
        Add student
      </Link>
    </div>

    <p className="text-micro tracking-[0.08em] text-muted uppercase">
      {appConfig.name} · {appConfig.year}
    </p>
  </div>
);

/**
 * Desktop rail plus a mobile drawer. The drawer is rendered by the layout so
 * the page behind it does not need to know about it.
 */
export const Sidebar = ({ isOpen, onClose }) => {
  const prefersReducedMotion = useReducedMotion();
  const { pathname } = useLocation();

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[264px] border-r border-line/70 bg-surface lg:block">
        <SidebarContent layoutGroup="desktop" pathname={pathname} />
      </aside>

      {isOpen ? (
        <div className="lg:hidden">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-40 bg-charcoal/45 backdrop-blur-[2px]"
            onClick={onClose}
            aria-hidden="true"
          />

          <motion.aside
            initial={prefersReducedMotion ? { opacity: 0 } : { x: '-100%' }}
            animate={prefersReducedMotion ? { opacity: 1 } : { x: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 36 }}
            className="fixed inset-y-0 left-0 z-50 w-[282px] max-w-[85vw] overflow-y-auto border-r border-line/70 bg-surface shadow-raised"
            aria-label="Navigation drawer"
          >
            <SidebarContent
              layoutGroup="mobile"
              onNavigate={onClose}
              onClose={onClose}
              pathname={pathname}
            />
          </motion.aside>
        </div>
      ) : null}
    </>
  );
};
