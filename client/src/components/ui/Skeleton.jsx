import { cx } from '../../utils/cx.js';

export const Skeleton = ({ className }) => (
  <span
    className={cx('block animate-pulse rounded-md bg-line/55', className)}
    aria-hidden="true"
  />
);

/**
 * Placeholder rows that match the shape of the student table, so the register
 * keeps its layout while it loads instead of collapsing to a spinner.
 */
export const TableSkeleton = ({ rows = 6, columns = 5 }) => (
  <div className="divide-y divide-line/50">
    {Array.from({ length: rows }).map((_, rowIndex) => (
      <div
        key={rowIndex}
        className="grid items-center gap-4 px-4 py-4 xl:px-panel"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: columns }).map((__, columnIndex) => (
          <Skeleton
            key={columnIndex}
            className={cx(
              'h-3.5',
              columnIndex === 0 ? 'w-40' : 'w-24',
              columnIndex > 1 && 'hidden md:block',
            )}
          />
        ))}
      </div>
    ))}
  </div>
);

export const StatCardSkeleton = () => (
  <div className="panel px-panel py-4 pt-5">
    <div className="flex items-start justify-between gap-3">
      <Skeleton className="h-3 w-28" />
      <Skeleton className="size-9 rounded-chip" />
    </div>
    <Skeleton className="mt-5 h-8 w-20" />
    <Skeleton className="mt-2.5 h-3 w-24" />
  </div>
);
