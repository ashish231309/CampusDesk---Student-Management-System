import { motion } from 'motion/react';

import { cx } from '../../utils/cx.js';
import { TableSkeleton } from './Skeleton.jsx';

const wrap = (content, className) => <div className={className}>{content}</div>;

/**
 * One table component for the whole product.
 *
 * The head is a quiet strip, the rows carry the content, and separation comes
 * from a hairline rather than a box per row — a register reads better as one
 * surface than as a stack of cards.
 *
 * Below `md` the tabular layout collapses to `renderMobileCard`, because a
 * five-column table is not something anyone should have to swipe sideways on a
 * phone. Columns that are useful but not essential can mark themselves
 * `hidden xl:table-cell` (see `StudentTable`) so the table stays readable on a
 * tablet instead of overflowing it.
 */
export const DataTable = ({
  columns = [],
  rows = [],
  getRowKey = (row) => row.id,
  renderMobileCard,
  isLoading = false,
  skeletonRows = 6,
  emptyState = null,
  className,
}) => {
  if (isLoading) return wrap(<TableSkeleton rows={skeletonRows} columns={columns.length} />, className);
  if (!rows.length) return wrap(emptyState, className);

  return (
    <div className={className}>
      <div className="hidden md:block">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-line/70 bg-surface-muted">
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={cx(
                    'px-4 py-3 text-left text-micro font-semibold text-muted uppercase whitespace-nowrap xl:px-panel',
                    column.align === 'right' && 'text-right',
                    column.headerClassName,
                  )}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-line/50">
            {rows.map((row, index) => (
              <motion.tr
                key={getRowKey(row)}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                // A row that is new since the last query fades in briefly. The
                // delay is capped low on purpose: changing a filter should not
                // make the table take a visible moment to arrive.
                transition={{ duration: 0.18, delay: Math.min(index * 0.02, 0.12) }}
                className="group transition-colors duration-150 hover:bg-beige/20"
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cx(
                      'px-4 py-3.5 align-middle text-body xl:px-panel',
                      column.align === 'right' && 'text-right',
                      column.cellClassName,
                    )}
                  >
                    {column.render ? column.render(row) : row[column.key]}
                  </td>
                ))}
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="divide-y divide-line/50 md:hidden">
        {renderMobileCard
          ? rows.map((row) => <div key={getRowKey(row)}>{renderMobileCard(row)}</div>)
          : rows.map((row) => (
              <div key={getRowKey(row)} className="px-4 py-4 text-body text-ink">
                {columns[0]?.render?.(row) ?? row[columns[0]?.key]}
              </div>
            ))}
      </div>
    </div>
  );
};
