import { cx } from '../../utils/cx.js';

/**
 * Panel hierarchy.
 *
 * Not everything is a card: `surface` is the default resting panel, `quiet` is a
 * supporting surface, `accent` marks something the user should notice, and
 * `dark` is reserved for the one band that carries the product's identity.
 */
const TONES = {
  surface: 'border-line/70 bg-surface shadow-card',
  quiet: 'border-line/60 bg-surface-muted',
  accent: 'border-beige-strong/60 bg-beige/35',
  dark: 'border-charcoal bg-charcoal text-canvas',
};

export const Card = ({ tone = 'surface', className, children, ...rest }) => (
  <div
    className={cx('rounded-panel border', TONES[tone] ?? TONES.surface, className)}
    {...rest}
  >
    {children}
  </div>
);

/**
 * A panel's heading. `eyebrow` sits above the title for the section the panel
 * belongs to, which is how a page stays legible once it has several panels.
 */
export const CardHeader = ({
  title,
  description,
  eyebrow,
  icon: Icon,
  action,
  tone = 'surface',
  className,
}) => (
  <div
    className={cx(
      'panel-header',
      tone === 'dark' ? 'border-canvas/15' : 'border-line/60',
      className,
    )}
  >
    <div className="flex min-w-0 items-start gap-3">
      {Icon ? (
        <span
          className={cx(
            'mt-0.5 grid size-9 shrink-0 place-items-center rounded-chip',
            tone === 'dark' ? 'bg-canvas/10 text-beige' : 'bg-beige/60 text-charcoal',
          )}
        >
          <Icon className="size-[18px]" aria-hidden="true" />
        </span>
      ) : null}

      <div className="min-w-0">
        {eyebrow ? (
          <p className={cx('eyebrow mb-1', tone === 'dark' && 'text-beige/80')}>{eyebrow}</p>
        ) : null}

        <h2
          className={cx(
            'text-heading leading-snug font-semibold',
            tone === 'dark' ? 'text-canvas' : 'text-ink',
          )}
        >
          {title}
        </h2>

        {description ? (
          <p
            className={cx(
              'mt-1 text-label',
              tone === 'dark' ? 'text-canvas/70' : 'text-muted',
            )}
          >
            {description}
          </p>
        ) : null}
      </div>
    </div>

    {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
  </div>
);

export const CardBody = ({ className, children }) => (
  <div className={cx('panel-body', className)}>{children}</div>
);

export const CardFooter = ({ className, children }) => (
  <div
    className={cx('panel-footer bg-surface-muted', className)}
  >
    {children}
  </div>
);
