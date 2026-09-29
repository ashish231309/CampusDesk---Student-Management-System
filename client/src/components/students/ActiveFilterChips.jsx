import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';

import { Badge } from '../ui/Badge.jsx';
import { Button } from '../ui/Button.jsx';

/** Shared timing so the chips and the sort chip move as one family. */
const CHIP_TRANSITION = { duration: 0.16, ease: [0.22, 1, 0.36, 1] };
const CHIP_PRESENCE = {
  initial: { opacity: 0, scale: 0.94 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.94 },
  transition: CHIP_TRANSITION,
};

const RemoveButton = ({ onRemove, label, icon: Icon = X }) => (
  <button
    type="button"
    onClick={onRemove}
    aria-label={label}
    className="focus-ring -mr-0.5 grid size-4 place-items-center rounded-full text-charcoal/70 transition-colors hover:bg-charcoal/12 hover:text-charcoal"
  >
    <Icon className="size-3" aria-hidden="true" />
  </button>
);

/**
 * What is currently narrowing the register, and a way to lift each part of it
 * without losing the rest.
 *
 * Filters and sorting are shown as separate chips because they are different
 * things: "Status: Active" changes *which* students are listed, "Sorted by:
 * Name A–Z" only changes their order. The count beside the heading counts the
 * filters, so the number the user reads means what it says.
 *
 * A chip appears when a filter is applied and leaves when it is lifted, which
 * makes the cause and effect visible; the remaining chips close the gap rather
 * than jumping. The motion is short and it follows the URL — the bar is never
 * showing a filter the query no longer contains — and the row is a live region,
 * so the change is announced as well as drawn.
 */
export const ActiveFilterChips = ({ filters, sort, onRemove, onClearAll }) => {
  const hasChips = filters.length > 0 || Boolean(sort);

  return (
    <AnimatePresence initial={false}>
      {hasChips ? (
        <motion.div
          key="active-filters"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.12 } }}
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
            <AnimatePresence initial={false}>
              {filters.map((filter) => (
                <motion.li key={filter.key} layout="position" {...CHIP_PRESENCE}>
                  <Badge tone="neutral" className="gap-2 py-1 pr-1.5 normal-case">
                    {filter.label}
                    <RemoveButton
                      onRemove={() => onRemove(filter.key)}
                      label={`Remove filter: ${filter.label}`}
                    />
                  </Badge>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>

          {/* Sorting is a chip too, so it can be put back to the default without
              touching any filter — but it is labelled as sorting, not as a
              filter, and it lives outside the filter list. */}
          <AnimatePresence initial={false}>
            {sort ? (
              <motion.span key="active-sort" layout="position" {...CHIP_PRESENCE}>
                <Badge tone="beige" className="gap-2 py-1 pr-1.5 normal-case">
                  Sorted by: {sort.label}
                  <RemoveButton
                    onRemove={() => onRemove(sort.key)}
                    label={`Reset sorting: currently ${sort.label}`}
                  />
                </Badge>
              </motion.span>
            ) : null}
          </AnimatePresence>

          {/* Removing one chip lifts only that filter — the rest stay exactly as
              they were, which is what makes narrowing a register bearable. */}
          <Button variant="ghost" size="sm" onClick={onClearAll} className="ml-auto">
            Clear all filters
          </Button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};
