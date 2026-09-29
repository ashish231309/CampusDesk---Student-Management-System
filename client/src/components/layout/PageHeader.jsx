import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

import { cx } from '../../utils/cx.js';

/**
 * The heading of a page: where you are, what this screen is, what it is for,
 * and what you can do here.
 *
 * The title comes from the type scale rather than a hardcoded size, so every
 * page's heading is the same size on the same screen width.
 */
export const PageHeader = ({ title, description, breadcrumbs = [], actions, aside, className }) => (
  <div
    className={cx(
      'mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between',
      className,
    )}
  >
    <div className="min-w-0">
      {breadcrumbs.length ? (
        <nav aria-label="Breadcrumb" className="mb-2">
          <ol className="flex flex-wrap items-center gap-1.5 text-meta text-muted">
            {breadcrumbs.map((crumb, index) => (
              <Fragment key={`${crumb.label}-${index}`}>
                {index > 0 ? (
                  <ChevronRight className="size-3.5 text-line-strong" aria-hidden="true" />
                ) : null}
                <li>
                  {crumb.to ? (
                    <Link
                      to={crumb.to}
                      className="rounded transition-colors hover:text-ink hover:underline hover:underline-offset-4"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="font-medium text-charcoal">{crumb.label}</span>
                  )}
                </li>
              </Fragment>
            ))}
          </ol>
        </nav>
      ) : null}

      <h2 className="text-title font-semibold text-ink">{title}</h2>

      {description ? (
        <p className="mt-2 max-w-2xl text-label leading-relaxed text-muted">{description}</p>
      ) : null}

      {aside ? <div className="mt-3">{aside}</div> : null}
    </div>

    {actions ? (
      <div className="flex flex-wrap items-center gap-2 lg:justify-end">{actions}</div>
    ) : null}
  </div>
);
