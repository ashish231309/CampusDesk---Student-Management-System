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

export const pattern = (regex, message) => (value) =>
  !value || regex.test(String(value)) ? undefined : message;

/**
 * A photo reference, in exactly the shapes the API accepts: an absolute http(s)
 * URL, a site-relative path such as `/photos/ananya.jpg`, or nothing at all
 * (which is how a photo is cleared). Anything else — a `javascript:` URL, a
 * stray word — is refused before the request is made.
 */
export const photoUrl = (message = 'Enter a link to the photo, or a path starting with /.') => (value) => {
  const text = String(value ?? '').trim();
  if (!text) return undefined;
  return /^(\/|https?:\/\/)\S*$/i.test(text) ? undefined : message;
};

/**
 * A registration date cannot be in the future — nobody is registered tomorrow.
 * The API enforces the same rule, and this is the first of the two: it stops an
 * obvious mistake at the field rather than spending a round trip on it. The date
 * input's own `max` is a hint, not a guarantee, because a typed value still gets
 * through — which is why the check is here as well as on the server.
 */
export const notFutureDate = (message = 'Choose a date that has already happened.') => (value) => {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return message;
  return parsed.getTime() > Date.now() ? message : undefined;
};

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
