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

const StepButton = ({ icon: Icon, label, onClick, disabled }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-label={label}
    className="focus-ring inline-flex h-9 items-center gap-1 rounded-field px-2.5 text-label font-medium text-charcoal transition-colors hover:bg-beige/50 disabled:pointer-events-none disabled:opacity-40"
  >
    <Icon className="size-4" aria-hidden="true" />
    <span className="hidden sm:inline">{label}</span>
  </button>
);

/**
 * Where the user is in the result — the one place the count, the page and the
 * page size are spelled out, so the register never repeats the same numbers in
 * two places. `isFiltered` only changes the wording: with filters or a search
 * applied, "24 matching students" is a more honest sentence than "24 students",
 * and it is a reminder that a subset is on screen.
 *
 * Every figure comes from the API's own `meta`; nothing here counts rows.
 */
export const Pagination = ({
  page = 1,
  totalPages = 1,
  total = 0,
  limit = 10,
  isFiltered = false,
  onPageChange,
  className,
}) => {
  const first = total === 0 ? 0 : (page - 1) * limit + 1;
  const last = Math.min(page * limit, total);

  return (
    <nav
      aria-label="Pagination"
      className={cx(
        'flex flex-col gap-3 border-t border-line/60 bg-surface-muted px-panel py-3.5 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <p className="text-label text-muted">
        {totalPages > 1 ? (
          <>
            Page <span className="font-semibold text-ink">{page}</span> of{' '}
            <span className="font-semibold text-ink">{formatCount(totalPages)}</span>
            <span className="px-1.5 text-line-strong" aria-hidden="true">
              ·
            </span>
          </>
        ) : null}
        Showing <span className="font-semibold text-ink">{first}</span>–
        <span className="font-semibold text-ink">{last}</span> of{' '}
        <span className="font-semibold text-ink">{formatCount(total)}</span>{' '}
        {isFiltered ? 'matching students' : 'students'}
      </p>

      {totalPages > 1 ? (
        <div className="flex items-center gap-1">
          <StepButton
            icon={ChevronLeft}
            label="Previous"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
          />

          <div className="flex items-center gap-0.5">
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
                  aria-label={`Page ${entry}`}
                  className={cx(
                    'focus-ring size-9 rounded-field text-label font-semibold transition-colors',
                    entry === page
                      ? 'bg-charcoal text-canvas'
                      : 'text-charcoal hover:bg-beige/50',
                  )}
                >
                  {entry}
                </button>
              ),
            )}
          </div>

          <StepButton
            icon={ChevronRight}
            label="Next"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
          />
        </div>
      ) : null}
    </nav>
  );
};
