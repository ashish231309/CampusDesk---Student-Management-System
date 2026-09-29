import { cx } from '../../utils/cx.js';

export const Skeleton = ({ className }) => (
  <span
    className={cx('block animate-pulse rounded-md bg-line/60', className)}
    aria-hidden="true"
  />
);

/** Placeholder rows that match the shape of the student table. */
export const TableSkeleton = ({ rows = 6, columns = 5 }) => (
  <div className="divide-y divide-line/60">
    {Array.from({ length: rows }).map((_, rowIndex) => (
      <div
        key={rowIndex}
        className="grid items-center gap-4 px-5 py-4"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: columns }).map((__, columnIndex) => (
          <Skeleton
            key={columnIndex}
            className={cx('h-3.5', columnIndex === 0 ? 'w-40' : 'w-24', columnIndex > 1 && 'hidden md:block')}
          />
        ))}
      </div>
    ))}
  </div>
);

export const StatCardSkeleton = () => (
  <div className="rounded-card border border-line/70 bg-surface p-5 shadow-card">
    <Skeleton className="h-9 w-9 rounded-xl" />
    <Skeleton className="mt-4 h-7 w-20" />
    <Skeleton className="mt-3 h-3 w-28" />
  </div>
);
