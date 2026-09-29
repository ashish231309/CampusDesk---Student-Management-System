import { cx } from '../../utils/cx.js';

const BASE =
  'focus-ring inline-flex shrink-0 items-center justify-center gap-2 rounded-field font-semibold whitespace-nowrap transition-[background-color,border-color,color,box-shadow] duration-150 disabled:cursor-not-allowed disabled:opacity-55';

/**
 * Five variants, each with one job. `danger` is deliberately the only filled
 * red in the product, and it always carries an icon and a label — colour is
 * never the only thing saying "this deletes something".
 */
const VARIANTS = {
  primary: 'bg-charcoal text-canvas shadow-button hover:bg-ink',
  secondary: 'border border-line-strong bg-surface text-ink hover:border-charcoal/40 hover:bg-canvas',
  soft: 'bg-beige text-charcoal hover:bg-beige-strong',
  ghost: 'text-charcoal hover:bg-beige/45',
  danger: 'bg-danger text-white shadow-button-danger hover:bg-danger/90',
  dangerGhost: 'text-danger hover:bg-danger/10',
};

const SIZES = {
  sm: 'h-9 px-3.5 text-label',
  md: 'h-11 px-5 text-body',
  lg: 'h-12 px-6 text-subheading',
  icon: 'size-10',
};

/**
 * Shared class builder so a `Link` can be styled exactly like a `Button`
 * without nesting interactive elements.
 */
export const buttonClasses = ({ variant = 'primary', size = 'md', className } = {}) =>
  cx(BASE, VARIANTS[variant] ?? VARIANTS.primary, SIZES[size] ?? SIZES.md, className);
