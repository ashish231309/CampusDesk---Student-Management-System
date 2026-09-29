import { useCallback, useMemo, useState } from 'react';
import { hasErrors, runRules } from '../utils/validation.js';

/**
 * Minimal controlled-form helper: values, per-field errors, touched state and
 * submit handling, without pulling in a form library for what are two simple
 * forms. Server-side validation errors can be merged back in through
 * `setErrors`, keeping the API as the source of truth.
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
    // Clear a field's error as soon as the user starts fixing it.
    setErrors((current) => (current[field] ? { ...current, [field]: undefined } : current));
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

  const reset = useCallback((nextValues = initialValues) => {
    setValues(nextValues);
    setErrors({});
    setTouched({});
    setSubmitError(null);
  }, [initialValues]);

  const handleSubmit = useCallback(
    (event) => {
      event?.preventDefault?.();

      const validationErrors = validateAll();
      setTouched(Object.fromEntries(Object.keys(schema).map((field) => [field, true])));
      setErrors(validationErrors);
      setSubmitError(null);

      if (hasErrors(validationErrors)) return undefined;
      setIsSubmitting(true);

      return Promise.resolve(onSubmit?.(values, { setErrors, setSubmitError }))
        .catch((error) => {
          // Let the caller surface the failure; keep the form usable.
          setSubmitError(error?.message ?? 'Something went wrong. Please try again.');
          if (error?.details) setErrors(error.details);
        })
        .finally(() => setIsSubmitting(false));
    },
    [onSubmit, schema, validateAll, values],
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
