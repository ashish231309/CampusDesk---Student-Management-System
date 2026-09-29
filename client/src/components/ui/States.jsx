import { motion } from 'motion/react';
import { CircleAlert, Info, RotateCcw, ServerCrash, TriangleAlert } from 'lucide-react';

import { cx } from '../../utils/cx.js';
import { Button } from './Button.jsx';

/**
 * Empty and error states share one layout so the two never look like they came
 * from different products. Both sit inside a panel and are meant to be read:
 * an icon, a short title, one sentence of explanation, and the action that
 * resolves it.
 */
const StateShell = ({
  icon: Icon,
  tone = 'neutral',
  title,
  description,
  action,
  className,
}) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
    className={cx('flex flex-col items-center justify-center px-6 py-14 text-center', className)}
  >
    <span
      className={cx(
        'grid size-14 place-items-center rounded-2xl',
        tone === 'danger' ? 'bg-danger/10 text-danger' : 'bg-beige/55 text-charcoal',
      )}
    >
      <Icon className="size-6" aria-hidden="true" />
    </span>

    <h3 className="mt-4 text-heading font-semibold text-ink">{title}</h3>
    {description ? (
      <p className="mt-1.5 max-w-sm text-label leading-relaxed text-muted">{description}</p>
    ) : null}
    {action ? <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div> : null}
  </motion.div>
);

/**
 * The banner above a form when the request itself failed — a rejected sign-in, a
 * server-side validation summary — and the one above it when there is something
 * to explain before the user starts (a session that expired, a rule that applies
 * to their account).
 *
 * Three tones, one shape, and the icon carries the meaning as well as the colour.
 * A failure is announced assertively; anything else is a status message, so a
 * screen reader is not interrupted for something that is not an error.
 */
const ALERT_TONES = {
  danger: { Icon: CircleAlert, accent: 'text-danger', frame: 'border-danger/25 bg-danger/[0.05]' },
  warning: {
    Icon: TriangleAlert,
    accent: 'text-warning-ink',
    frame: 'border-warning/35 bg-warning/[0.06]',
  },
  info: { Icon: Info, accent: 'text-info', frame: 'border-info/25 bg-info/[0.06]' },
};

export const FormAlert = ({ children, tone = 'danger', className }) => {
  const { Icon, accent, frame } = ALERT_TONES[tone] ?? ALERT_TONES.danger;

  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cx('flex items-start gap-3 rounded-card border px-4 py-3', frame, className)}
    >
      <Icon className={cx('mt-0.5 size-4 shrink-0', accent)} aria-hidden="true" />
      <p className="text-label leading-relaxed text-ink">{children}</p>
    </div>
  );
};

export const EmptyState = ({ icon, title, description, action, className }) => (
  <StateShell
    icon={icon}
    title={title}
    description={description}
    action={action}
    className={className}
  />
);

export const ErrorState = ({ title = 'We could not load this', description, onRetry, className }) => (
  <StateShell
    icon={ServerCrash}
    tone="danger"
    title={title}
    description={description}
    className={className}
    action={
      onRetry ? (
        <Button variant="secondary" icon={RotateCcw} onClick={onRetry}>
          Try again
        </Button>
      ) : null
    }
  />
);
