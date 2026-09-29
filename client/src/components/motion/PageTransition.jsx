import { motion, useReducedMotion } from 'motion/react';

const EASE = [0.22, 1, 0.36, 1];

/**
 * Wraps a route's content so every page enters the same way — a short rise and
 * fade, skipped when the visitor prefers reduced motion.
 */
export const PageTransition = ({ children, className, delay = 0 }) => {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: prefersReducedMotion ? 0.2 : 0.45, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
};
