/**
 * Small validation toolkit. Rules are plain functions returning an error
 * message (or nothing) so the same definitions can drive field-level and
 * whole-form checks. The messages mirror the API validators — the server stays
 * the source of truth and re-validates everything.
 */

export const required = (message = 'This field is required.') => (value) =>
  value === undefined || value === null || String(value).trim() === '' ? message : undefined;

export const email = (message = 'Enter a valid email address.') => (value) =>
  !value || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value).trim()) ? undefined : message;

export const phone = (message = 'Enter a valid phone number.') => (value) =>
  !value || /^[+]?[\d\s()-]{7,20}$/.test(String(value).trim()) ? undefined : message;

export const minLength = (length, message) => (value) =>
  !value || String(value).trim().length >= length
    ? undefined
    : message ?? `Must be at least ${length} characters.`;

export const maxLength = (length, message) => (value) =>
  !value || String(value).trim().length <= length
    ? undefined
    : message ?? `Must be ${length} characters or fewer.`;

export const oneOf = (values, message) => (value) =>
  !value || values.includes(value) ? undefined : message ?? 'Choose one of the available options.';

export const url = (message = 'Enter a valid URL.') => (value) => {
  if (!value) return undefined;
  try {
    const parsed = new URL(String(value).trim());
    return ['http:', 'https:'].includes(parsed.protocol) ? undefined : message;
  } catch {
    return message;
  }
};

export const pattern = (regex, message) => (value) =>
  !value || regex.test(String(value)) ? undefined : message;

/** Run a schema ({ field: [rules] }) over a values object. */
export const runRules = (values, schema) => {
  const errors = {};

  for (const [field, rules] of Object.entries(schema)) {
    for (const rule of [rules].flat()) {
      const message = rule(values[field], values);
      if (message) {
        errors[field] = message;
        break;
      }
    }
  }

  return errors;
};

export const hasErrors = (errors = {}) => Object.keys(errors).length > 0;
