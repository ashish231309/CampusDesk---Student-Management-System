import { forwardRef } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Loader2 } from 'lucide-react';

import { buttonClasses } from './buttonStyles.js';

export const Button = forwardRef(function Button(
  {
    variant = 'primary',
    size = 'md',
    icon: Icon,
    iconRight: IconRight,
    isLoading = false,
    className,
    children,
    type = 'button',
    disabled,
    ...rest
  },
  ref,
) {
  const prefersReducedMotion = useReducedMotion();
  // Press feedback only: the button dips very slightly under the pointer, and
  // nothing moves if the user prefers reduced motion or the button is inert.
  // A loading button is disabled in the same render, so it cannot be pressed —
  // or pressed twice — while the request is in flight.
  const pressFeedback =
    prefersReducedMotion || disabled || isLoading ? undefined : { scale: 0.97 };

  return (
    <motion.button
      ref={ref}
      type={type}
      whileTap={pressFeedback}
      transition={{ duration: 0.12, ease: 'easeOut' }}
      className={buttonClasses({ variant, size, className })}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      {...rest}
    >
      {isLoading ? (
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      ) : (
        Icon && <Icon className="size-4" aria-hidden="true" />
      )}

      {children}

      {IconRight && !isLoading ? <IconRight className="size-4" aria-hidden="true" /> : null}
    </motion.button>
  );
});

/** Square icon-only action used in table rows and toolbars. */
export const IconButton = forwardRef(function IconButton(
  { icon: Icon, label, variant = 'ghost', className, disabled, ...rest },
  ref,
) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.button
      ref={ref}
      type="button"
      whileTap={prefersReducedMotion || disabled ? undefined : { scale: 0.96 }}
      transition={{ duration: 0.12, ease: 'easeOut' }}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={buttonClasses({ variant, size: 'icon', className })}
      {...rest}
    >
      <Icon className="size-4" aria-hidden="true" />
    </motion.button>
  );
});
