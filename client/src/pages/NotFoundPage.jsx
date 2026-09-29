import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Compass } from 'lucide-react';

import { Logo } from '../components/branding/Logo.jsx';
import { buttonClasses } from '../components/ui/buttonStyles.js';
import { paths } from '../routes/paths.js';
import { useAuth } from '../context/authContext.js';
import { cx } from '../utils/cx.js';

/**
 * The not-found screen.
 *
 * The same page is used twice: on its own for a URL that belongs to no part of
 * the application, and inside the signed-in shell when the route exists but the
 * page behind it does not — which is why it asks for its variant rather than
 * assuming a full viewport.
 */
export default function NotFoundPage({ variant = 'standalone' }) {
  const { isAuthenticated } = useAuth();

  return (
    <div
      className={cx(
        'grid place-items-center px-4',
        variant === 'app' ? 'py-10' : 'min-h-dvh bg-canvas',
      )}
    >
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md rounded-card border border-line/70 bg-surface p-8 text-center shadow-card"
      >
        <div className="flex justify-center">
          <Logo withWordmark={false} size="lg" />
        </div>

        <p className="mt-6 text-[12px] font-semibold tracking-widest text-muted uppercase">
          Error 404
        </p>
        <h1 className="mt-2 text-[24px] font-semibold tracking-tight text-ink">
          This page is not on the register
        </h1>
        <p className="mt-2.5 text-sm leading-relaxed text-muted">
          The page you were looking for has moved or never existed. Head back to the dashboard and
          carry on from there.
        </p>

        <div className="mt-7 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link to={isAuthenticated ? paths.dashboard : paths.login} className={buttonClasses({})}>
            {isAuthenticated ? 'Go to dashboard' : 'Sign in'}
          </Link>
          <Link to={paths.home} className={buttonClasses({ variant: 'secondary' })}>
            Back to home
          </Link>
        </div>

        <p className="mt-6 inline-flex items-center gap-1.5 text-[12px] text-muted">
          <Compass className="size-3.5" aria-hidden="true" />
          CampusDesk support can help if this keeps happening.
        </p>
      </motion.div>
    </div>
  );
}
