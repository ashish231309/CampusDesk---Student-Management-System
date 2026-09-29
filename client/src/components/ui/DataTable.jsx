import { motion } from 'motion/react';

import { cx } from '../../utils/cx.js';
import { TableSkeleton } from './Skeleton.jsx';

const wrap = (content, className) => <div className={className}>{content}</div>;

/**
 * One table component for the whole product.
 *
 * Below `md` the tabular layout collapses to `renderMobileCard`, because a
 * five-column table is not something anyone should have to swipe sideways on a
 * phone.
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
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-line/70 bg-canvas/60">
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={cx(
                    'px-5 py-3 text-left text-[11px] font-semibold tracking-wider text-muted uppercase whitespace-nowrap',
                    column.align === 'right' && 'text-right',
                    column.headerClassName,
                  )}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-line/60">
            {rows.map((row, index) => (
              <motion.tr
                key={getRowKey(row)}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.25, delay: Math.min(index * 0.03, 0.24) }}
                className="transition-colors duration-150 hover:bg-beige/25"
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cx(
                      'px-5 py-3.5 align-middle',
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

      <div className="divide-y divide-line/60 md:hidden">
        {renderMobileCard
          ? rows.map((row) => <div key={getRowKey(row)}>{renderMobileCard(row)}</div>)
          : rows.map((row) => (
              <div key={getRowKey(row)} className="px-4 py-4 text-sm text-ink">
                {columns[0]?.render?.(row) ?? row[columns[0]?.key]}
              </div>
            ))}
      </div>
    </div>
  );
};
