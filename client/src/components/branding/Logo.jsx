import { cx } from '../../utils/cx.js';

const SIZES = {
  sm: 'size-8 rounded-chip',
  md: 'size-10 rounded-xl',
  lg: 'size-12 rounded-2xl',
};

const WORDMARK_SIZES = {
  sm: 'text-subheading',
  md: 'text-heading',
  lg: 'text-title',
};

/**
 * The CampusDesk mark: a "C" resting on a desk line, cut from the beige tile
 * that anchors the product's identity.
 */
export const LogoMark = ({ size = 'md', className, label = 'CampusDesk' }) => (
  <span
    className={cx(
      'inline-grid shrink-0 place-items-center bg-beige text-charcoal',
      SIZES[size] ?? SIZES.md,
      className,
    )}
  >
    {/* The mark is drawn in the current colour: charcoal on the beige tile, and
        the same shape works on a dark ground without a second drawing. */}
    <svg viewBox="0 0 40 40" className="size-[62%]" role="img" aria-label={label}>
      <path
        d="M27.5 14.5a9 9 0 1 0 0 11"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.4"
        strokeLinecap="round"
      />
      <path d="M13.5 30.5h17" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" />
    </svg>
  </span>
);

export const Logo = ({
  size = 'md',
  withWordmark = true,
  tagline = false,
  inverted = false,
  className,
}) => (
  <span className={cx('inline-flex items-center gap-3', className)}>
    <LogoMark size={size} />

    {withWordmark ? (
      <span className="flex flex-col leading-none">
        <span
          className={cx(
            'font-extrabold tracking-tight',
            WORDMARK_SIZES[size] ?? WORDMARK_SIZES.md,
            inverted ? 'text-canvas' : 'text-ink',
          )}
        >
          Campus
          <span className={inverted ? 'text-beige' : 'text-muted'}>Desk</span>
        </span>

        {tagline ? (
          <span
            className={cx(
              'mt-1 text-micro font-medium uppercase',
              inverted ? 'text-canvas/60' : 'text-muted',
            )}
          >
            Student Management
          </span>
        ) : null}
      </span>
    ) : null}
  </span>
);
