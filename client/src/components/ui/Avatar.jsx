import { cx } from '../../utils/cx.js';
import { getInitials } from '../../utils/format.js';

const SIZES = {
  xs: 'size-8 text-[11px]',
  sm: 'size-9 text-xs',
  md: 'size-11 text-sm',
  lg: 'size-16 text-lg',
  xl: 'size-20 text-2xl',
};

// Every tone is drawn from the approved palette — no extra colours.
const TONES = [
  'bg-beige text-charcoal',
  'bg-charcoal text-canvas',
  'bg-beige-strong text-ink',
  'bg-line text-ink',
];

const toneFor = (name = '') =>
  TONES[[...name].reduce((total, char) => total + char.charCodeAt(0), 0) % TONES.length];

export const Avatar = ({ name = '', src, size = 'md', className }) => (
  <span
    className={cx(
      'inline-grid shrink-0 place-items-center overflow-hidden rounded-full font-semibold select-none',
      SIZES[size] ?? SIZES.md,
      !src && toneFor(name),
      className,
    )}
    aria-hidden={src ? undefined : 'true'}
  >
    {src ? (
      <img src={src} alt={name ? `${name} profile photo` : 'Profile photo'} className="size-full object-cover" />
    ) : (
      getInitials(name)
    )}
  </span>
);
