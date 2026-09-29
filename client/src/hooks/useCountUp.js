import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';

const easeOutCubic = (progress) => 1 - (1 - progress) ** 3;

/**
 * Counts a figure to its target value.
 *
 * The interesting case is the second time it runs. A dashboard refresh replaces
 * the number it was showing with a new one, and an eager count-up would replay
 * the whole entrance — 248 → 0 → 250 — which reads as data loss. So the
 * animation always starts from the value currently on screen and moves to the
 * new target: the first mount counts up from zero (a short entrance that says
 * "here is the size of the register"), and every later change is an update from
 * the previous real figure to the new one, retiring exactly on the API value.
 *
 * When the target has not changed there is nothing to animate, so an unrelated
 * re-render cannot restart it. Under reduced motion the figure is simply the
 * target, immediately, and no frame is ever requested.
 */
export const useCountUp = (target = 0, { duration = 520 } = {}) => {
  const prefersReducedMotion = useReducedMotion();
  const safeTarget = Number.isFinite(Number(target)) ? Number(target) : 0;

  const [value, setValue] = useState(0);
  // Where the next animation starts from — the figure the user can see. It is
  // only ever read inside the effect and written inside the frame callback, so
  // nothing about it can leak into a render.
  const displayed = useRef(0);

  useEffect(() => {
    if (prefersReducedMotion) {
      // Keep the remembered figure honest while nothing is animating, so that
      // switching the preference back on cannot start a count from zero.
      displayed.current = safeTarget;
      return undefined;
    }

    const from = displayed.current;
    if (from === safeTarget) return undefined;

    let frame;
    const start = performance.now();

    const step = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const next = Math.round(from + (safeTarget - from) * easeOutCubic(progress));

      displayed.current = next;
      setValue(next);

      if (progress < 1) {
        frame = requestAnimationFrame(step);
      } else {
        // Land on the API's own value rather than on a rounded approximation.
        displayed.current = safeTarget;
        setValue(safeTarget);
      }
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [duration, prefersReducedMotion, safeTarget]);

  return prefersReducedMotion ? safeTarget : value;
};
