import { Children, cloneElement, forwardRef, isValidElement, useId } from 'react';
import { ChevronDown } from 'lucide-react';

import { cx } from '../../utils/cx.js';

const baseControl =
  'w-full rounded-field border bg-surface px-3.5 text-sm text-ink transition-colors duration-150 placeholder:text-muted/70 hover:border-charcoal/30 focus:outline-none focus-visible:border-charcoal focus-visible:ring-2 focus-visible:ring-charcoal/15 disabled:cursor-not-allowed disabled:bg-canvas disabled:text-muted';

const controlClasses = ({ hasError, className } = {}) =>
  cx(
    baseControl,
    'h-11',
    hasError ? 'border-danger focus-visible:border-danger focus-visible:ring-danger/15' : 'border-line',
    className,
  );

/** Label + control + message, wired together for accessibility. */
export const Field = ({ id, label, hint, error, required, children, className }) => {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const messageId = `${fieldId}-message`;

  return (
    <div className={cx('space-y-1.5', className)}>
      <label htmlFor={fieldId} className="block text-[13px] font-semibold text-charcoal">
        {label}
        {required ? (
          <span className="ml-1 text-danger" aria-hidden="true">
            *
          </span>
        ) : (
          <span className="ml-1.5 text-[11px] font-medium text-muted">optional</span>
        )}
      </label>

      {/* The first child is the control; anything after it (such as a reveal
          button) is positioned against this wrapper. */}
      <div className="relative">
        {Children.map(children, (child, index) =>
          isValidElement(child) && index === 0
            ? cloneElement(child, {
                id: fieldId,
                'aria-describedby': error || hint ? messageId : undefined,
                'aria-invalid': error ? true : undefined,
              })
            : child,
        )}
      </div>

      {error ? (
        <p id={messageId} className="text-[13px] font-medium text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={messageId} className="text-[13px] text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
};

export const TextInput = forwardRef(function TextInput({ hasError, className, ...rest }, ref) {
  return <input ref={ref} className={controlClasses({ hasError, className })} {...rest} />;
});

export const Select = forwardRef(function Select(
  { hasError, className, children, ...rest },
  ref,
) {
  return (
    <div className="relative">
      <select
        ref={ref}
        className={cx(controlClasses({ hasError }), 'appearance-none pr-10', className)}
        {...rest}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-muted"
        aria-hidden="true"
      />
    </div>
  );
});
