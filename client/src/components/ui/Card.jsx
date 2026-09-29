import { cx } from '../../utils/cx.js';

export const Card = ({ className, children, ...rest }) => (
  <div
    className={cx('rounded-card border border-line/70 bg-surface shadow-card', className)}
    {...rest}
  >
    {children}
  </div>
);

export const CardHeader = ({ title, description, icon: Icon, action, className }) => (
  <div
    className={cx(
      'flex flex-wrap items-start justify-between gap-3 border-b border-line/60 px-5 py-4',
      className,
    )}
  >
    <div className="flex min-w-0 items-start gap-3">
      {Icon ? (
        <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-beige/60 text-charcoal">
          <Icon className="size-[18px]" aria-hidden="true" />
        </span>
      ) : null}

      <div className="min-w-0">
        <h2 className="text-[15px] leading-tight font-semibold text-ink">{title}</h2>
        {description ? <p className="mt-1 text-[13px] text-muted">{description}</p> : null}
      </div>
    </div>

    {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
  </div>
);

export const CardBody = ({ className, children }) => (
  <div className={cx('px-5 py-4', className)}>{children}</div>
);

export const CardFooter = ({ className, children }) => (
  <div className={cx('border-t border-line/60 bg-canvas/60 px-5 py-3', className)}>{children}</div>
);
