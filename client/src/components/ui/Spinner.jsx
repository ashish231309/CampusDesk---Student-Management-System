import { Loader2 } from 'lucide-react';

import { cx } from '../../utils/cx.js';

export const Spinner = ({ className, label }) => (
  <span className={cx('inline-flex items-center gap-2 text-muted', className)} role="status">
    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
    {label ? <span className="text-label">{label}</span> : null}
    <span className="sr-only">{label ?? 'Loading'}</span>
  </span>
);

/**
 * Fallback for a page being code-split inside a shell that is already on screen
 * — the sidebar and top bar stay put and only the content area waits.
 */
export const ContentLoader = ({ label = 'Loading this page…' }) => (
  <div className="grid min-h-[55vh] place-items-center" role="status" aria-live="polite">
    <div className="flex flex-col items-center gap-3">
      <span className="grid size-10 animate-pulse place-items-center rounded-chip bg-beige">
        <Loader2 className="size-4 animate-spin text-charcoal" aria-hidden="true" />
      </span>
      <p className="text-label font-medium text-muted">{label}</p>
    </div>
  </div>
);

/** Full-page fallback used while a route is being restored or code-split. */
export const PageLoader = ({ label = 'Loading CampusDesk…' }) => (
  <div className="grid min-h-dvh place-items-center bg-canvas" role="status" aria-live="polite">
    <div className="flex flex-col items-center gap-3">
      <span className="grid size-12 animate-pulse place-items-center rounded-2xl bg-beige">
        <Loader2 className="size-5 animate-spin text-charcoal" aria-hidden="true" />
      </span>
      <p className="text-label font-medium text-muted">{label}</p>
    </div>
  </div>
);
