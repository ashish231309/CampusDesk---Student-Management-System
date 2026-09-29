import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

import { cx } from '../../utils/cx.js';

export const PageHeader = ({ title, description, breadcrumbs = [], actions, className }) => (
  <div
    className={cx(
      'mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between',
      className,
    )}
  >
    <div className="min-w-0">
      {breadcrumbs.length ? (
        <nav aria-label="Breadcrumb" className="mb-2">
          <ol className="flex flex-wrap items-center gap-1.5 text-[12px] text-muted">
            {breadcrumbs.map((crumb, index) => (
              <Fragment key={`${crumb.label}-${index}`}>
                {index > 0 ? (
                  <ChevronRight className="size-3.5 text-line" aria-hidden="true" />
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

      <h2 className="text-[22px] leading-tight font-semibold tracking-tight text-ink sm:text-[26px]">
        {title}
      </h2>

      {description ? (
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted">{description}</p>
      ) : null}
    </div>

    {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
  </div>
);
