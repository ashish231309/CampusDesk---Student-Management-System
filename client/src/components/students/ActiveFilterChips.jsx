import { X } from 'lucide-react';

import { Badge } from '../ui/Badge.jsx';
import { Button } from '../ui/Button.jsx';

/**
 * What is currently narrowing the register, and a way to lift each part of it
 * without losing the rest.
 *
 * Filters and sorting are shown as separate chips because they are different
 * things: "Status: Active" changes *which* students are listed, "Sorted by:
 * Name A–Z" only changes their order. The count beside the heading counts the
 * filters, so the number the user reads means what it says.
 *
 * Rendering nothing when nothing is active is deliberate: an empty "Filtering
 * by" bar is noise on every visit to a screen the user has not filtered.
 */
export const ActiveFilterChips = ({ filters, sort, onRemove, onClearAll }) => {
  if (!filters.length && !sort) return null;

  return (
    <div
      className="flex flex-wrap items-center gap-2 border-b border-line/60 bg-beige/25 px-panel py-3"
      aria-live="polite"
    >
      <span className="eyebrow">Filtering by</span>
      {filters.length > 0 ? (
        <span className="rounded-full border border-line bg-surface px-2 py-0.5 text-micro font-semibold tracking-normal text-charcoal">
          {filters.length} {filters.length === 1 ? 'filter' : 'filters'}
        </span>
      ) : null}

      <ul className="flex flex-wrap items-center gap-2">
        {filters.map((filter) => (
          <li key={filter.key}>
            <Badge tone="neutral" className="gap-2 py-1 pr-1.5 normal-case">
              {filter.label}
              <button
                type="button"
                onClick={() => onRemove(filter.key)}
                aria-label={`Remove filter: ${filter.label}`}
                className="focus-ring -mr-0.5 grid size-4 place-items-center rounded-full text-charcoal/70 transition-colors hover:bg-charcoal/12 hover:text-charcoal"
              >
                <X className="size-3" aria-hidden="true" />
              </button>
            </Badge>
          </li>
        ))}
      </ul>

      {/* Sorting is a chip too, so it can be put back to the default without
          touching any filter — but it is labelled as sorting, not as a filter. */}
      {sort ? (
        <Badge tone="beige" className="gap-2 py-1 pr-1.5 normal-case">
          Sorted by: {sort.label}
          <button
            type="button"
            onClick={() => onRemove(sort.key)}
            aria-label={`Reset sorting: currently ${sort.label}`}
            className="focus-ring -mr-0.5 grid size-4 place-items-center rounded-full text-charcoal/70 transition-colors hover:bg-charcoal/12 hover:text-charcoal"
          >
            <X className="size-3" aria-hidden="true" />
          </button>
        </Badge>
      ) : null}

      {/* Removing one chip lifts only that filter — the rest stay exactly as
          they were, which is what makes narrowing a register bearable. */}
      <Button variant="ghost" size="sm" onClick={onClearAll} className="ml-auto">
        Clear all filters
      </Button>
    </div>
  );
};
