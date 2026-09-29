import { Loader2, Search, X } from 'lucide-react';

import { cx } from '../../utils/cx.js';

/**
 * Search control for the student list. The clear affordance only appears when
 * there is something to clear, and the input stays a plain text field so
 * browser autofill and mobile keyboards behave normally.
 *
 * `isBusy` swaps the leading magnifier for a spinner while the search it started
 * is still in flight — the one piece of feedback that tells a user their typing
 * has been picked up but the register has not answered yet. It is announced
 * through `aria-busy` as well, and never blocks the field: the next keystroke
 * still lands, and cancels the request it supersedes.
 */
export const SearchInput = ({
  value,
  onChange,
  onClear,
  isBusy = false,
  placeholder = 'Search students…',
  label = 'Search students',
  className,
  ...rest
}) => (
  <div className={cx('relative', className)}>
    {isBusy ? (
      <Loader2
        className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 animate-spin text-charcoal"
        aria-hidden="true"
      />
    ) : (
      <Search
        className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted"
        aria-hidden="true"
      />
    )}

    <input
      type="search"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      aria-label={label}
      aria-busy={isBusy || undefined}
      className="h-11 w-full rounded-field border border-line bg-surface pr-10 pl-10 text-body text-ink transition-[border-color,box-shadow] duration-150 placeholder:text-muted/70 hover:border-line-strong focus:border-charcoal focus:outline-none focus-visible:ring-2 focus-visible:ring-charcoal/18 [&::-webkit-search-cancel-button]:hidden"
      {...rest}
    />

    {value ? (
      <button
        type="button"
        onClick={onClear}
        aria-label="Clear search"
        className="focus-ring absolute top-1/2 right-2 grid size-7 -translate-y-1/2 place-items-center rounded-full text-muted transition-colors hover:bg-beige hover:text-ink"
      >
        <X className="size-3.5" aria-hidden="true" />
      </button>
    ) : null}
  </div>
);
