import { motion } from 'motion/react';

import { cx } from '../../utils/cx.js';

/**
 * Two-or-three option picker used for short, mutually exclusive choices such as
 * enrollment status. The active pill slides between options, which makes the
 * current value unmistakable.
 */
export const SegmentedControl = ({ name, label, options = [], value, onChange, className }) => (
  <div
    role="radiogroup"
    aria-label={label}
    className={cx(
      'flex w-full gap-1 rounded-field border border-line bg-canvas p-1',
      className,
    )}
  >
    {options.map((option) => {
      const isActive = option.value === value;

      return (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={isActive}
          onClick={() => onChange(option.value)}
          className={cx(
            'focus-ring relative flex-1 rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors duration-150',
            isActive ? 'text-ink' : 'text-muted hover:text-charcoal',
          )}
        >
          {isActive ? (
            <motion.span
              layoutId={`segmented-${name}`}
              className="absolute inset-0 -z-10 rounded-lg bg-surface shadow-card"
              transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            />
          ) : null}

          {option.label}
        </button>
      );
    })}
  </div>
);
