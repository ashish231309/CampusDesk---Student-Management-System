import { Link, Outlet, useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, IdCard, ShieldCheck, Sparkles } from 'lucide-react';

import { Logo } from '../branding/Logo.jsx';
import { appConfig } from '../../config/app.js';
import { authPanels } from '../../config/authPanels.js';
import { paths } from '../../routes/paths.js';

/** The three standing claims about the product, shown on both account screens. */
const ASSURANCES = [
  { icon: IdCard, label: 'Student IDs issued automatically' },
  { icon: ShieldCheck, label: 'Roles decided by the server, never the form' },
  { icon: Sparkles, label: 'One register for the whole campus' },
];

/**
 * The shell shared by the public account pages (sign in, create account).
 *
 * It owns everything those two screens have in common — the dark brand panel,
 * the column the form lives in, the way back and the small-screen logo — so the
 * pages themselves are only their form.
 *
 * Desktop gets a genuine two-panel composition; below `lg` the panel is dropped
 * and the same identity survives as a compact masthead, because a phone should
 * not have to scroll past marketing to reach the form.
 *
 * The landing page keeps its own marketing shell: it is a different kind of page,
 * and folding it in here would be a redesign rather than a tidy-up.
 */
export const PublicLayout = () => {
  const { pathname } = useLocation();
  const panel = authPanels[pathname] ?? authPanels.login;

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.02fr_1fr]">
      {/* Brand panel — desktop only. */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-charcoal px-10 py-12 lg:flex xl:px-14">
        <div
          className="absolute -top-28 -right-24 size-[440px] rounded-full bg-beige/12 blur-3xl"
          aria-hidden="true"
        />

        <Link to={paths.home} className="focus-ring relative inline-flex rounded">
          <Logo inverted />
        </Link>

        <div className="relative max-w-md">
          <p className="text-micro font-semibold tracking-[0.14em] text-beige/80 uppercase">
            {panel.eyebrow}
          </p>

          <h2 className="mt-3 text-[2rem] leading-[1.12] font-semibold text-canvas xl:text-[2.35rem]">
            {panel.heading}
          </h2>

          <p className="mt-4 text-body leading-relaxed text-canvas/70">{panel.intro}</p>

          <ul className="mt-8 space-y-3">
            {panel.highlights.map((highlight) => (
              <li
                key={highlight}
                className="flex items-start gap-3 text-label leading-relaxed text-canvas/80"
              >
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-beige" aria-hidden="true" />
                {highlight}
              </li>
            ))}
          </ul>
        </div>

        <ul className="relative space-y-2.5 border-t border-canvas/12 pt-6">
          {ASSURANCES.map(({ icon: Icon, label }) => (
            <li key={label} className="flex items-center gap-2.5 text-meta text-canvas/60">
              <Icon className="size-4 shrink-0 text-beige" aria-hidden="true" />
              {label}
            </li>
          ))}
        </ul>
      </aside>

      <main className="flex flex-col justify-center bg-canvas px-4 py-10 sm:px-8 lg:px-12 lg:py-14">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto w-full max-w-[440px]"
        >
          {/* Compact masthead where the brand panel is not shown. */}
          <div className="mb-7 flex items-center justify-between gap-3 lg:hidden">
            <Logo tagline />
            <Link
              to={panel.back.to}
              className="focus-ring inline-flex items-center gap-1.5 rounded text-meta font-medium text-muted transition-colors hover:text-ink"
            >
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              {panel.back.short}
            </Link>
          </div>

          <Link
            to={panel.back.to}
            className="focus-ring hidden items-center gap-1.5 rounded text-meta font-medium text-muted transition-colors hover:text-ink lg:inline-flex"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            {panel.back.label}
          </Link>

          <div className="mt-0 rounded-panel border border-line/70 bg-surface px-panel py-6 shadow-card sm:px-7 sm:py-8 lg:mt-7">
            <Outlet />
          </div>

          <p className="mt-5 text-center text-meta text-muted">
            {appConfig.name} · {appConfig.tagline}
          </p>
        </motion.div>
      </main>
    </div>
  );
};
