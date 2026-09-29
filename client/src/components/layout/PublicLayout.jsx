import { Link, Outlet, useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft } from 'lucide-react';

import { Logo } from '../branding/Logo.jsx';
import { appConfig } from '../../config/app.js';
import { authPanels } from '../../config/authPanels.js';
import { paths } from '../../routes/paths.js';

/**
 * The shell shared by the public account pages (sign in, create account).
 *
 * It owns everything those two screens have in common — the dark brand panel,
 * the column the form lives in, the way back, and the small-screen logo — so the
 * pages themselves are only their form. The landing page keeps its own marketing
 * shell: it is a different kind of page, and folding it in here would be a
 * redesign rather than a tidy-up.
 *
 * The panel copy is chosen from the current path, which is the one place the two
 * screens differ, and lives in `config/authPanels.js`.
 */
export const PublicLayout = () => {
  const { pathname } = useLocation();
  const panel = authPanels[pathname] ?? authPanels.login;

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.05fr]">
      {/* Brand panel — hidden on small screens where the form is the whole point. */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-charcoal px-10 py-12 lg:flex">
        <div
          className="absolute -top-24 -right-24 size-[420px] rounded-full bg-beige/15 blur-2xl"
          aria-hidden="true"
        />

        <Link to={paths.home} className="relative inline-flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-beige">
            <svg viewBox="0 0 40 40" className="size-6" role="img" aria-label="CampusDesk">
              <path
                d="M27.5 14.5a9 9 0 1 0 0 11"
                fill="none"
                stroke="#323232"
                strokeWidth="3.4"
                strokeLinecap="round"
              />
              <path d="M13.5 30.5h17" stroke="#323232" strokeWidth="3.4" strokeLinecap="round" />
            </svg>
          </span>
          <span className="text-[17px] font-extrabold tracking-tight text-canvas">
            Campus<span className="text-beige">Desk</span>
          </span>
        </Link>

        <div className="relative max-w-md">
          <h2 className="text-[30px] leading-tight font-semibold text-canvas">{panel.heading}</h2>

          <ul className="mt-6 space-y-3">
            {panel.highlights.map((highlight) => (
              <li
                key={highlight}
                className="flex items-start gap-3 text-sm leading-relaxed text-canvas/75"
              >
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-beige" aria-hidden="true" />
                {highlight}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-[12px] text-canvas/50">
          {appConfig.name} · {appConfig.tagline}
        </p>
      </aside>

      <main className="flex flex-col justify-center bg-canvas px-4 py-10 sm:px-8 lg:px-14">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto w-full max-w-[420px]"
        >
          <Link
            to={panel.back.to}
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted transition-colors hover:text-ink"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            {panel.back.label}
          </Link>

          <div className="mt-6 lg:hidden">
            <Logo tagline />
          </div>

          <Outlet />
        </motion.div>
      </main>
    </div>
  );
};
