import { useEffect, useState } from 'react';
import { useReducedMotion } from 'motion/react';

const easeOutCubic = (progress) => 1 - (1 - progress) ** 3;

/**
 * Counts a number up to its target once, on mount. When the visitor prefers
 * reduced motion the target is simply returned, so the figure is never animated.
 */
export const useCountUp = (target = 0, { duration = 900 } = {}) => {
  const prefersReducedMotion = useReducedMotion();
  const [value, setValue] = useState(() => (prefersReducedMotion ? target : 0));

  useEffect(() => {
    if (prefersReducedMotion) return undefined;

    let frame;
    const start = performance.now();

    const step = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      setValue(Math.round(target * easeOutCubic(progress)));
      if (progress < 1) frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [duration, prefersReducedMotion, target]);

  return prefersReducedMotion ? target : value;
};
