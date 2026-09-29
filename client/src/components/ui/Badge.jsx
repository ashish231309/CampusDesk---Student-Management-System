import { cx } from '../../utils/cx.js';

const TONES = {
  neutral: 'border-beige bg-beige/60 text-charcoal',
  outline: 'border-line bg-surface text-muted',
  success: 'border-success/25 bg-success/10 text-success',
  warning: 'border-warning/25 bg-warning/10 text-warning',
  danger: 'border-danger/25 bg-danger/10 text-danger',
  info: 'border-info/25 bg-info/10 text-info',
};

export const Badge = ({ tone = 'neutral', className, children }) => (
  <span
    className={cx(
      'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide uppercase',
      TONES[tone] ?? TONES.neutral,
      className,
    )}
  >
    {children}
  </span>
);

const DOT_TONES = {
  active: 'bg-success',
  inactive: 'bg-muted',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
};

/** Enrollment status: a dot plus a label reads faster than colour alone. */
export const StatusPill = ({ status = 'active', label, className }) => (
  <span
    className={cx(
      'inline-flex items-center gap-2 rounded-full border border-line/80 bg-surface px-2.5 py-1 text-xs font-medium text-ink',
      className,
    )}
  >
    <span
      className={cx('size-2 rounded-full', DOT_TONES[status] ?? DOT_TONES.inactive)}
      aria-hidden="true"
    />
    {label ?? (status === 'active' ? 'Active' : 'Inactive')}
  </span>
);
