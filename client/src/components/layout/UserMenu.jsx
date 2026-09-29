import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown, LogOut } from 'lucide-react';

import { Avatar } from '../ui/Avatar.jsx';
import { useAuth } from '../../context/authContext.js';
import { paths } from '../../routes/paths.js';
import { useToast } from '../../context/toastContext.js';
import { cx } from '../../utils/cx.js';

/** Account menu in the top bar: identity plus the sign-out action. */
export const UserMenu = () => {
  const { user, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) setIsOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await logout();
      toast.info('You have been signed out.', 'Signed out');
      navigate(paths.login, { replace: true });
    } finally {
      setIsSigningOut(false);
      setIsOpen(false);
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className="focus-ring flex items-center gap-2 rounded-field border border-transparent py-1.5 pr-2 pl-1.5 transition-colors hover:border-line hover:bg-surface"
      >
        <Avatar name={user?.name} size="sm" />
        <span className="hidden text-left sm:block">
          <span className="block text-label leading-tight font-semibold text-ink">
            {user?.name ?? 'Account'}
          </span>
          <span className="block text-micro tracking-normal leading-tight text-muted capitalize">
            {user?.role ?? 'administrator'}
          </span>
        </span>
        <ChevronDown
          className={cx('size-4 text-muted transition-transform duration-200', isOpen && 'rotate-180')}
          aria-hidden="true"
        />
      </button>

      <AnimatePresence>
        {isOpen ? (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-panel border border-line/70 bg-surface shadow-raised"
          >
            <div className="border-b border-line/60 px-4 py-3">
              <p className="text-body font-semibold text-ink">{user?.name}</p>
              <p className="mt-0.5 truncate text-meta text-muted">{user?.email ?? '—'}</p>
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-beige/70 px-2 py-1 text-micro font-semibold tracking-normal text-charcoal capitalize">
                {user?.role ?? 'staff'}
              </p>
            </div>

            <button
              type="button"
              role="menuitem"
              onClick={handleSignOut}
              disabled={isSigningOut}
              className="focus-ring flex w-full items-center gap-2.5 px-4 py-3 text-body font-medium text-ink transition-colors hover:bg-beige/35 disabled:opacity-60"
            >
              <LogOut className="size-4 text-muted" aria-hidden="true" />
              {isSigningOut ? 'Signing out…' : 'Sign out'}
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
};
