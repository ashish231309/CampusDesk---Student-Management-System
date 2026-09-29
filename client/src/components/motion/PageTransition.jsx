import { motion, useReducedMotion } from 'motion/react';

const EASE = [0.22, 1, 0.36, 1];

/**
 * Wraps a route's content so every page enters the same way — a short rise and
 * fade, skipped when the visitor prefers reduced motion.
 *
 * It is deliberately the only route transition in the product, and it is short:
 * navigation should feel immediate, and the movement is here to say "this is a
 * new screen", not to be watched. Under reduced motion the content simply fades,
 * so nothing moves and nothing is delayed.
 */
export const PageTransition = ({ children, className }) => {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      // No `delay` prop: a route entrance is never staggered behind anything, so
      // there is no way to make a screen wait for an animation.
      transition={{ duration: prefersReducedMotion ? 0.16 : 0.3, ease: EASE }}
    >
      {children}
    </motion.div>
  );
};
