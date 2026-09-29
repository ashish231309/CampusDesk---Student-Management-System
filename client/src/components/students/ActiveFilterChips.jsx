import { X } from 'lucide-react';

import { Badge } from '../ui/Badge.jsx';
import { Button } from '../ui/Button.jsx';

/**
 * What is currently narrowing the register, and a way to lift each part of it
 * without losing the rest. Rendered only when something is actually active —
 * an empty "Filtering by" bar is just noise.
 */
export const ActiveFilterChips = ({ filters, onRemove, onClearAll }) => {
  if (!filters.length) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-line/60 bg-canvas/40 px-5 py-3">
      <span className="text-[12px] font-semibold tracking-wide text-muted uppercase">
        Filtering by
      </span>

      {filters.map((filter) => (
        <Badge key={filter.key} tone="neutral" className="gap-2 normal-case">
          {filter.label}
          <button
            type="button"
            onClick={() => onRemove(filter.key)}
            aria-label={`Remove filter: ${filter.label}`}
            className="focus-ring -mr-1 grid size-4 place-items-center rounded-full text-charcoal/70 transition-colors hover:bg-charcoal/10 hover:text-charcoal"
          >
            <X className="size-3" aria-hidden="true" />
          </button>
        </Badge>
      ))}

      <Button variant="ghost" size="sm" onClick={onClearAll} className="ml-auto">
        Clear all
      </Button>
    </div>
  );
};
