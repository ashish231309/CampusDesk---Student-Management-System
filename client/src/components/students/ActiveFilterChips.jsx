import { X } from 'lucide-react';

import { Badge } from '../ui/Badge.jsx';
import { Button } from '../ui/Button.jsx';

/**
 * What is currently narrowing the register, and a way to lift each part of it
 * without losing the rest.
 *
 * Rendering nothing when nothing is active is deliberate: an empty "Filtering
 * by" bar is noise on every visit to a screen the user has not filtered.
 */
export const ActiveFilterChips = ({ filters, onRemove, onClearAll }) => {
  if (!filters.length) return null;

  return (
    <div
      className="flex flex-wrap items-center gap-2 border-b border-line/60 bg-beige/25 px-panel py-3"
      aria-live="polite"
    >
      <span className="eyebrow">Filtering by</span>

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

      <Button variant="ghost" size="sm" onClick={onClearAll} className="ml-auto">
        Clear all
      </Button>
    </div>
  );
};
