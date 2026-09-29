import { cx } from '../../utils/cx.js';

const SIZES = {
  sm: 'size-8 rounded-[10px]',
  md: 'size-10 rounded-xl',
  lg: 'size-12 rounded-2xl',
};

/**
 * The CampusDesk mark: a "C" resting on a desk line, cut from the beige tile
 * that anchors the product's identity.
 */
export const LogoMark = ({ size = 'md', className }) => (
  <span
    className={cx('inline-grid shrink-0 place-items-center bg-beige', SIZES[size] ?? SIZES.md, className)}
  >
    <svg viewBox="0 0 40 40" className="size-[62%]" role="img" aria-label="CampusDesk">
      <path
        d="M27.5 14.5a9 9 0 1 0 0 11"
        fill="none"
        stroke="#323232"
        strokeWidth="3.4"
        strokeLinecap="round"
      />
      <path d="M13.5 30.5h17" stroke="#323232" strokeWidth="3.4" strokeLinecap="round" />
    </svg>
  </span>
);

export const Logo = ({ size = 'md', withWordmark = true, tagline = false, className }) => (
  <span className={cx('inline-flex items-center gap-3', className)}>
    <LogoMark size={size} />

    {withWordmark ? (
      <span className="flex flex-col leading-none">
        <span className="text-[17px] font-extrabold tracking-tight text-ink">
          Campus<span className="text-muted">Desk</span>
        </span>
        {tagline ? (
          <span className="mt-0.5 text-[11px] font-medium tracking-wide text-muted uppercase">
            Student Management
          </span>
        ) : null}
      </span>
    ) : null}
  </span>
);
