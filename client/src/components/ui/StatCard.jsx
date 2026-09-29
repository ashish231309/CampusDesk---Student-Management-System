import { motion } from 'motion/react';

import { cx } from '../../utils/cx.js';
import { formatCount } from '../../utils/format.js';
import { useCountUp } from '../../hooks/useCountUp.js';

const TONES = {
  beige: 'bg-beige/60 text-charcoal',
  charcoal: 'bg-charcoal text-canvas',
  success: 'bg-success/10 text-success',
  info: 'bg-info/10 text-info',
  warning: 'bg-warning/10 text-warning-ink',
};

/**
 * A single figure from the register summary.
 *
 * The layout puts the label first and the number second, because the label is
 * what makes the number mean anything. The figure counts up once on mount — a
 * small, purposeful animation that draws the eye to the number rather than
 * decorating the panel.
 */
export const StatCard = ({ label, value = 0, icon: Icon, hint, tone = 'beige', index = 0 }) => {
  const animatedValue = useCountUp(value);

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
      className="panel px-panel py-4 pt-5 transition-shadow duration-200 hover:shadow-raised"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="eyebrow">{label}</p>
        <span className={cx('grid size-9 place-items-center rounded-chip', TONES[tone] ?? TONES.beige)}>
          {Icon ? <Icon className="size-[17px]" aria-hidden="true" /> : null}
        </span>
      </div>

      <p className="mt-4 text-3xl leading-none font-semibold tracking-tight text-ink">
        <span className="tabular-nums">{formatCount(animatedValue)}</span>
      </p>

      {hint ? <p className="mt-2 text-meta text-muted">{hint}</p> : null}
    </motion.article>
  );
};
