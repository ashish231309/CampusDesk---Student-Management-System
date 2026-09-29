import { useCallback, useMemo, useState } from 'react';
import { hasErrors, runRules } from '../utils/validation.js';
import { errorMessage } from '../utils/apiErrors.js';

/**
 * Move the caret to the first field the user has to fix.
 *
 * A long form that fails validation should not leave the visitor scrolling to
 * find what is wrong, so the first invalid control in the form's own field order
 * takes focus — which also reads it out through its `aria-describedby` message.
 * Controls that are deliberately disabled (the registration date for a staff
 * account) are skipped, because focus would never land on them.
 */
const focusFirstInvalid = (form, fieldErrors, order) => {
  if (!form?.elements) return;
  const field = order.find((name) => fieldErrors[name]);
  if (!field) return;

  const control = form.elements.namedItem(field);
  if (control instanceof HTMLElement && !control.disabled) control.focus();
};

/**
 * Minimal controlled-form helper: values, per-field errors, touched state and
 * submit handling, without pulling in a form library for what are a handful of
 * simple forms. Server-side validation errors can be merged back in through
 * `setErrors`, keeping the API as the source of truth.
 *
 * The lifecycle it guarantees, for every form in the product:
 *
 *   idle → editing → submitting → success, validation error or server error
 *
 * A second submit cannot start while the first is in flight, a field's own error
 * clears as soon as it is edited, and a failure keeps the entered values exactly
 * as they are — a temporary outage must not cost the user their typing.
 */
export const useForm = ({ initialValues, schema = {}, onSubmit }) => {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const validateAll = useCallback(() => runRules(values, schema), [values, schema]);

  const setFieldValue = useCallback((field, value) => {
    setValues((current) => ({ ...current, [field]: value }));
    // Clear a field's error as soon as the user starts fixing it, and let the
    // failure banner go too: it described the attempt that has now been edited.
    setErrors((current) => (current[field] ? { ...current, [field]: undefined } : current));
    setSubmitError((current) => (current === null ? current : null));
  }, []);

  const handleChange = useCallback(
    (field) => (event) => {
      const target = event?.target ?? event;
      setFieldValue(field, target.type === 'checkbox' ? target.checked : target.value);
    },
    [setFieldValue],
  );

  const handleBlur = useCallback(
    (field) => () => {
      setTouched((current) => ({ ...current, [field]: true }));
      const fieldErrors = runRules(values, { [field]: schema[field] ?? [] });
      setErrors((current) => ({ ...current, [field]: fieldErrors[field] }));
    },
    [schema, values],
  );

  const reset = useCallback(
    (nextValues = initialValues) => {
      setValues(nextValues);
      setErrors({});
      setTouched({});
      setSubmitError(null);
    },
    [initialValues],
  );

  const handleSubmit = useCallback(
    (event) => {
      event?.preventDefault?.();

      // Guard against a second submit while one is in flight: a double-click or
      // an Enter keypress must not create the same student twice.
      if (isSubmitting) return undefined;

      const form = event?.target?.elements ? event.target : null;
      const fieldOrder = Object.keys(schema);
      const validationErrors = validateAll();

      setTouched(Object.fromEntries(fieldOrder.map((field) => [field, true])));
      setErrors(validationErrors);
      setSubmitError(null);

      if (hasErrors(validationErrors)) {
        focusFirstInvalid(form, validationErrors, fieldOrder);
        return undefined;
      }

      setIsSubmitting(true);

      return Promise.resolve(onSubmit?.(values, { setErrors, setSubmitError }))
        .catch((error) => {
          // Keep the form usable and say why in words a visitor can act on; the
          // API's own field-level `details` land on their inputs below.
          const details = error?.details ?? null;
          setSubmitError(errorMessage(error));
          if (details) {
            setErrors(details);
            focusFirstInvalid(form, details, fieldOrder);
          }
        })
        .finally(() => setIsSubmitting(false));
    },
    [isSubmitting, onSubmit, schema, validateAll, values],
  );

  const isValid = useMemo(() => !hasErrors(validateAll()), [validateAll]);

  /** Only show an error once the user has touched the field or tried to submit. */
  const errorFor = useCallback((field) => (touched[field] ? errors[field] : undefined), [errors, touched]);

  return {
    values,
    errors,
    touched,
    isValid,
    isSubmitting,
    submitError,
    setValues,
    setErrors,
    setSubmitError,
    setFieldValue,
    handleChange,
    handleBlur,
    handleSubmit,
    reset,
    errorFor,
  };
};
