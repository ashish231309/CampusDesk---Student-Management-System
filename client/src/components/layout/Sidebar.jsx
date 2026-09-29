import { Link, useLocation } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import { X } from 'lucide-react';

import { Logo } from '../branding/Logo.jsx';
import { IconButton } from '../ui/Button.jsx';
import { isNavigationItemActive, navigationGroups } from '../../config/navigation.js';
import { appConfig } from '../../config/app.js';
import { cx } from '../../utils/cx.js';

/**
 * One navigation link. Active state comes from the shared rule in
 * `config/navigation.js` rather than from the router's own prefix matching, so
 * styling and `aria-current` always agree and nested student routes behave.
 */
const NavItem = ({ item, onNavigate, layoutGroup, pathname }) => {
  const isActive = isNavigationItemActive(item, pathname);

  return (
    <Link
      to={item.to}
      onClick={onNavigate}
      aria-current={isActive ? 'page' : undefined}
      className={cx(
        'focus-ring group relative flex items-center gap-3 rounded-field px-3 py-2.5 text-sm font-medium transition-colors duration-150',
        isActive ? 'text-ink' : 'text-charcoal/80 hover:bg-beige/45 hover:text-ink',
      )}
    >
      {isActive ? (
        <motion.span
          layoutId={`sidebar-active-${layoutGroup}`}
          className="absolute inset-0 -z-10 rounded-field bg-beige"
          transition={{ type: 'spring', stiffness: 420, damping: 34 }}
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
  <div className="flex h-full flex-col gap-8 px-4 py-5">
    <div className="flex items-center justify-between">
      <Logo tagline />
      {onClose ? <IconButton icon={X} label="Close navigation" onClick={onClose} /> : null}
    </div>

    <nav className="flex-1 space-y-6" aria-label="Main navigation">
      {navigationGroups.map((group) => (
        <div key={group.label}>
          <p className="px-3 pb-2 text-[11px] font-semibold tracking-wider text-muted uppercase">
            {group.label}
          </p>

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

    <div className="rounded-card border border-line/70 bg-canvas/70 p-3.5">
      <p className="text-[13px] font-semibold text-ink">CampusDesk {appConfig.year}</p>
      <p className="mt-0.5 text-[12px] leading-relaxed text-muted">
        Student records, enrollment and campus administration in one place.
      </p>
    </div>
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
            className="fixed inset-0 z-40 bg-charcoal/40 backdrop-blur-[2px]"
            onClick={onClose}
            aria-hidden="true"
          />

          <motion.aside
            initial={prefersReducedMotion ? { opacity: 0 } : { x: '-100%' }}
            animate={prefersReducedMotion ? { opacity: 1 } : { x: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 36 }}
            className="fixed inset-y-0 left-0 z-50 w-[282px] max-w-[85vw] border-r border-line/70 bg-surface shadow-raised"
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
