import { forwardRef } from 'react';
import { motion } from 'motion/react';
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
  return (
    <motion.button
      ref={ref}
      type={type}
      whileTap={disabled || isLoading ? undefined : { scale: 0.975 }}
      transition={{ duration: 0.12 }}
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
  { icon: Icon, label, variant = 'ghost', className, ...rest },
  ref,
) {
  return (
    <motion.button
      ref={ref}
      type="button"
      whileTap={{ scale: 0.94 }}
      aria-label={label}
      title={label}
      className={buttonClasses({ variant, size: 'icon', className })}
      {...rest}
    >
      <Icon className="size-4" aria-hidden="true" />
    </motion.button>
  );
});
