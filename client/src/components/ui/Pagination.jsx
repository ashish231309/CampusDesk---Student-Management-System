import { ChevronLeft, ChevronRight } from 'lucide-react';

import { cx } from '../../utils/cx.js';
import { formatCount } from '../../utils/format.js';

/** Page numbers around the current page, with ellipses for long ranges. */
const buildRange = (page, totalPages) => {
  if (totalPages <= 5) return Array.from({ length: totalPages }, (_, index) => index + 1);

  const pages = new Set([1, totalPages, page, page - 1, page + 1]);
  const sorted = [...pages].filter((value) => value >= 1 && value <= totalPages).sort((a, b) => a - b);

  const withGaps = [];
  sorted.forEach((value, index) => {
    if (index > 0 && value - sorted[index - 1] > 1) withGaps.push('gap');
    withGaps.push(value);
  });

  return withGaps;
};

export const Pagination = ({ page = 1, totalPages = 1, total = 0, limit = 10, onPageChange, className }) => {
  const first = total === 0 ? 0 : (page - 1) * limit + 1;
  const last = Math.min(page * limit, total);

  return (
    <nav
      aria-label="Pagination"
      className={cx(
        'flex flex-col gap-3 border-t border-line/60 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <p className="text-[13px] text-muted" aria-live="polite">
        Showing <span className="font-semibold text-ink">{first}</span>–
        <span className="font-semibold text-ink">{last}</span> of{' '}
        <span className="font-semibold text-ink">{formatCount(total)}</span> students
      </p>

      {totalPages > 1 ? (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="focus-ring inline-flex h-9 items-center gap-1 rounded-field px-2.5 text-[13px] font-medium text-charcoal transition-colors hover:bg-beige/50 disabled:pointer-events-none disabled:opacity-40"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">Previous</span>
          </button>

          {buildRange(page, totalPages).map((entry, index) =>
            entry === 'gap' ? (
              <span key={`gap-${index}`} className="px-1 text-muted" aria-hidden="true">
                …
              </span>
            ) : (
              <button
                key={entry}
                type="button"
                onClick={() => onPageChange(entry)}
                aria-current={entry === page ? 'page' : undefined}
                className={cx(
                  'focus-ring size-9 rounded-field text-[13px] font-semibold transition-colors',
                  entry === page
                    ? 'bg-charcoal text-canvas'
                    : 'text-charcoal hover:bg-beige/50',
                )}
              >
                {entry}
              </button>
            ),
          )}

          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="focus-ring inline-flex h-9 items-center gap-1 rounded-field px-2.5 text-[13px] font-medium text-charcoal transition-colors hover:bg-beige/50 disabled:pointer-events-none disabled:opacity-40"
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </nav>
  );
};
