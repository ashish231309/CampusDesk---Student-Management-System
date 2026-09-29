import { cx } from '../../utils/cx.js';

const BASE =
  'focus-ring inline-flex shrink-0 items-center justify-center gap-2 rounded-field font-semibold transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-60';

const VARIANTS = {
  primary: 'bg-charcoal text-canvas hover:bg-ink',
  secondary: 'border border-line bg-surface text-ink hover:border-charcoal/35 hover:bg-beige/35',
  soft: 'bg-beige text-charcoal hover:bg-beige-strong',
  ghost: 'text-charcoal hover:bg-beige/45',
  danger: 'bg-danger text-white hover:bg-danger/90',
};

const SIZES = {
  sm: 'h-9 px-3.5 text-[13px]',
  md: 'h-11 px-5 text-sm',
  lg: 'h-12 px-6 text-[15px]',
  icon: 'size-10',
};

/**
 * Shared class builder so a `Link` can be styled exactly like a `Button`
 * without nesting interactive elements.
 */
export const buttonClasses = ({ variant = 'primary', size = 'md', className } = {}) =>
  cx(BASE, VARIANTS[variant] ?? VARIANTS.primary, SIZES[size] ?? SIZES.md, className);
