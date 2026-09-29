import { motion } from 'motion/react';
import { RotateCcw, ServerCrash } from 'lucide-react';

import { cx } from '../../utils/cx.js';
import { Button } from './Button.jsx';

/**
 * Empty and error states share one layout so the two never look like they came
 * from different products.
 */
const StateShell = ({ icon: Icon, iconTone = 'bg-beige/70 text-charcoal', title, description, action, className }) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
    className={cx('flex flex-col items-center justify-center px-6 py-14 text-center', className)}
  >
    <span className={cx('grid size-14 place-items-center rounded-2xl', iconTone)}>
      <Icon className="size-6" aria-hidden="true" />
    </span>

    <h3 className="mt-4 text-base font-semibold text-ink">{title}</h3>
    {description ? (
      <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted">{description}</p>
    ) : null}
    {action ? <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div> : null}
  </motion.div>
);

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
    iconTone="bg-danger/10 text-danger"
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
