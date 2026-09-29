import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowUpRight } from 'lucide-react';

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

const cardFrame = 'panel px-panel py-4 pt-5 transition-shadow duration-200 hover:shadow-raised';

/**
 * A single figure from the register summary.
 *
 * The layout puts the label first and the number second, because the label is
 * what makes the number mean anything. The figure counts up once on mount — a
 * small, purposeful animation that draws the eye to the number rather than
 * decorating the panel.
 *
 * Given a `to`, the whole card becomes one link into the register, already
 * narrowed to the students that figure describes (`toLabel` names where it goes
 * for anyone who cannot see the arrow). The card stays a single target rather
 * than a card containing a small "view" link, so there is no ambiguity about
 * what is clickable — and it is a real link, so the keyboard and the middle
 * mouse button both work.
 */
export const StatCard = ({
  label,
  value = 0,
  icon: Icon,
  hint,
  tone = 'beige',
  index = 0,
  to,
  toLabel = 'Open in the register',
}) => {
  const animatedValue = useCountUp(value);

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="eyebrow">{label}</p>
        <span
          className={cx(
            'grid size-9 place-items-center rounded-chip',
            TONES[tone] ?? TONES.beige,
          )}
        >
          {Icon ? <Icon className="size-[17px]" aria-hidden="true" /> : null}
        </span>
      </div>

      <p className="mt-4 text-3xl leading-none font-semibold tracking-tight text-ink">
        <span className="tabular-nums">{formatCount(animatedValue)}</span>
      </p>

      {hint || to ? (
        <p className="mt-2 flex items-center gap-1.5 text-meta text-muted">
          {hint}
          {to ? <ArrowUpRight className="size-3.5 shrink-0" aria-hidden="true" /> : null}
        </p>
      ) : null}
    </>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
      className="h-full"
    >
      {to ? (
        <Link to={to} className={cx(cardFrame, 'focus-ring block h-full')}>
          {body}
          <span className="sr-only">{toLabel}</span>
        </Link>
      ) : (
        <article className={cx(cardFrame, 'h-full')}>{body}</article>
      )}
    </motion.div>
  );
};
