import { ApiRequestError } from '../services/apiClient.js';

/**
 * One place that turns an API failure into something worth showing a user.
 *
 * The API already sends a good message for most failures; this adds the cases
 * where the *status* is more useful than the text — a 503 is a database
 * outage, a 429 means "try again shortly", and a 403 is a permissions problem
 * rather than a mistake in the form. Driver details, stack traces and internal
 * identifiers never reach the screen because they never reach the API response
 * in the first place; nothing here invents detail the server did not send.
 */

const MESSAGES = {
  403: 'Your account does not have permission to do that.',
  404: 'That record could not be found. It may have been removed.',
  429: 'Too many requests just now. Please wait a moment and try again.',
  500: 'Something went wrong on our end. Please try again.',
  503: 'CampusDesk cannot reach its database right now. Please try again shortly.',
};

const NETWORK_MESSAGE =
  'CampusDesk could not reach the API. Check your connection and try again.';

/** A short, safe sentence for any thrown value. */
export const errorMessage = (error, fallback = 'Something unexpected went wrong. Please try again.') => {
  if (!(error instanceof ApiRequestError)) return fallback;

  // A mapped status wins for the states the server reports generically.
  if (MESSAGES[error.status]) return MESSAGES[error.status];

  return error.message || fallback;
};

/** Field-level messages from a 422, ready to merge into a form. */
export const fieldErrors = (error) => {
  if (!(error instanceof ApiRequestError) || !error.details) return {};

  return Object.fromEntries(
    Object.entries(error.details).filter(([, message]) => typeof message === 'string'),
  );
};

/**
 * How a failed load should read. `kind` lets a page pick the matching state
 * without re-deriving it from a status code:
 *   'unauthenticated' | 'forbidden' | 'missing' | 'offline' | 'unavailable' | 'error'
 */
export const describeLoadError = (error) => {
  if (!(error instanceof ApiRequestError)) {
    return { kind: 'error', message: errorMessage(error) };
  }

  if (error.isNetworkError) return { kind: 'offline', message: NETWORK_MESSAGE };
  if (error.isUnauthorized) return { kind: 'unauthenticated', message: errorMessage(error) };
  if (error.isForbidden) return { kind: 'forbidden', message: errorMessage(error) };
  if (error.isNotFound || error.isValidationError) return { kind: 'missing', message: errorMessage(error) };
  if (error.status === 503) return { kind: 'unavailable', message: errorMessage(error) };

  return { kind: 'error', message: errorMessage(error) };
};
