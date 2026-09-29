import { Children, cloneElement, forwardRef, isValidElement, useId } from 'react';
import { ChevronDown, CircleAlert } from 'lucide-react';

import { cx } from '../../utils/cx.js';

const baseControl =
  'w-full rounded-field border bg-surface px-3.5 text-ink transition-[border-color,box-shadow,background-color] duration-150 placeholder:text-muted/70 hover:border-line-strong focus:outline-none focus-visible:border-charcoal focus-visible:ring-2 focus-visible:ring-charcoal/18 disabled:cursor-not-allowed disabled:border-line/70 disabled:bg-canvas disabled:text-muted';

const controlClasses = ({ hasError, isActive, className } = {}) =>
  cx(
    baseControl,
    'text-body',
    hasError
      ? 'border-danger focus-visible:border-danger focus-visible:ring-danger/18'
      : isActive
        ? // A control that is currently narrowing the register says so at a
          // glance, without relying on the value being read closely.
          'border-beige-strong bg-beige/25 font-semibold hover:border-charcoal/40'
        : 'border-line',
    className,
  );

/**
 * Label + control + message, wired together for accessibility:
 * the label points at the control, and any hint or error is announced through
 * `aria-describedby` with `aria-invalid` set when the field is rejected.
 */
export const Field = ({ id, label, hint, error, required, children, className, labelAction }) => {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const messageId = `${fieldId}-message`;

  return (
    <div className={cx('space-y-1.5', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={fieldId} className="field-label">
          {label}
          {required ? (
            <span className="ml-1 text-danger" aria-hidden="true">
              *
            </span>
          ) : (
            <span className="ml-1.5 text-micro font-medium tracking-normal text-muted normal-case">
              optional
            </span>
          )}
        </label>

        {labelAction}
      </div>

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
        <p id={messageId} className="flex items-start gap-1.5 text-meta font-medium text-danger">
          <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : hint ? (
        <p id={messageId} className="text-meta text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
};

export const TextInput = forwardRef(function TextInput({ hasError, className, ...rest }, ref) {
  return (
    <input ref={ref} className={cx(controlClasses({ hasError, className }), 'h-11')} {...rest} />
  );
});

export const Select = forwardRef(function Select(
  { hasError, isActive = false, className, children, ...rest },
  ref,
) {
  return (
    <div className="relative">
      <select
        ref={ref}
        className={cx(controlClasses({ hasError, isActive }), 'h-11 appearance-none pr-10', className)}
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
