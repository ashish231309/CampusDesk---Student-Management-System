import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { useReducedMotion } from 'motion/react';

const ENTER_EASE = 'power2.out';
const ENTER_DURATION = 0.42;
const ENTER_STAGGER = 0.04;
const ENTER_STAGGER_LIMIT = 0.16;
const UPDATE_DURATION = 0.28;

/**
 * The one place GSAP is used inside the application shell: the measured bars on
 * the dashboard.
 *
 * A bar is the one element on the dashboard whose *length* is the fact being
 * communicated, and letting it grow once, from the left, is the clearest way to
 * say "this is a proportion of the register". Three rules keep it honest:
 *
 *  - **The markup stays the source of truth.** React renders each bar at its
 *    final width, so the value is correct in the HTML, before hydration, and on
 *    a device that never runs the animation. GSAP only animates towards the
 *    width React already declared — it never decides it.
 *  - **It runs before paint.** `useLayoutEffect` means the grow-in is committed
 *    in the same frame as the markup, so a bar never flashes at full length and
 *    then jumps back to zero.
 *  - **Entrance and update are different.** The first run of a given bar grows
 *    it from zero; a later run — after a student was added, edited or deleted —
 *    slides it from the width it already had to the new one. A refresh is a
 *    change, not a restart.
 *
 * `signature` is a short string describing the data on screen. The effect only
 * re-runs when that actually changes, so a re-render with the same numbers
 * cannot restart an animation. Markup contract: any element inside the scope
 * with a `data-bar="<key>"` attribute is animated, and the element's own inline
 * width is the target. Reduced motion skips GSAP entirely — the bars are simply
 * already the right length.
 */
export const useBarGrowth = (signature = '') => {
  const scopeRef = useRef(null);
  const painted = useRef(new Map());
  const prefersReducedMotion = useReducedMotion();

  useLayoutEffect(() => {
    const scope = scopeRef.current;
    if (!scope || prefersReducedMotion) return undefined;

    const context = gsap.context(() => {
      gsap.utils.toArray('[data-bar]').forEach((bar, index) => {
        const key = bar.dataset.bar;
        const width = bar.style.width;
        if (!key || !width) return;

        const previous = painted.current.get(key);
        const isEntrance = previous === undefined;
        painted.current.set(key, width);

        gsap.fromTo(
          bar,
          { width: isEntrance ? '0%' : previous },
          {
            width,
            duration: isEntrance ? ENTER_DURATION : UPDATE_DURATION,
            ease: ENTER_EASE,
            delay: isEntrance ? Math.min(index * ENTER_STAGGER, ENTER_STAGGER_LIMIT) : 0,
            overwrite: 'auto',
          },
        );
      });
    }, scope);

    // Reverting restores the width React declared, so the markup is never left
    // holding a value GSAP invented — and no tween survives the component.
    return () => context.revert();
  }, [prefersReducedMotion, signature]);

  return scopeRef;
};
