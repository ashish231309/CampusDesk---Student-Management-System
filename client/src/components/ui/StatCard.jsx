import { motion } from 'motion/react';

import { cx } from '../../utils/cx.js';
import { formatCount } from '../../utils/format.js';
import { useCountUp } from '../../hooks/useCountUp.js';

const TONES = {
  beige: 'bg-beige/60 text-charcoal',
  charcoal: 'bg-charcoal text-canvas',
  success: 'bg-success/10 text-success',
  info: 'bg-info/10 text-info',
  warning: 'bg-warning/10 text-warning',
};

/**
 * Dashboard summary card. The figure counts up once on mount — a small,
 * purposeful animation that draws the eye to the number instead of decorating
 * the card.
 */
export const StatCard = ({ label, value = 0, icon: Icon, hint, tone = 'beige', index = 0 }) => {
  const animatedValue = useCountUp(value);

  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: index * 0.07, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -2 }}
      className="rounded-card border border-line/70 bg-surface p-5 shadow-card transition-shadow duration-200 hover:shadow-raised"
    >
      <span className={cx('grid size-10 place-items-center rounded-xl', TONES[tone] ?? TONES.beige)}>
        {Icon ? <Icon className="size-[18px]" aria-hidden="true" /> : null}
      </span>

      <p className="mt-4 text-3xl leading-none font-semibold tracking-tight text-ink tabular-nums">
        {formatCount(animatedValue)}
      </p>
      <p className="mt-2 text-sm font-medium text-charcoal">{label}</p>
      {hint ? <p className="mt-0.5 text-[13px] text-muted">{hint}</p> : null}
    </motion.article>
  );
};
