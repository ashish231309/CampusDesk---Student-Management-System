import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';

const MONGOOSE_VALIDATION = 'ValidationError';
const MONGOOSE_CAST = 'CastError';
const MONGOOSE_VERSION = 'VersionError';
const DUPLICATE_KEY = 11000;
const DATABASE_DOWN = new Set([
  'MongoServerSelectionError',
  'MongoNotConnectedError',
  'MongoNetworkError',
  'MongooseServerSelectionError',
]);

/** Translate whatever was thrown into our standard error envelope. */
const normalise = (error) => {
  if (error instanceof ApiError) return error;

  if (error?.name === MONGOOSE_VALIDATION) {
    const details = Object.fromEntries(
      Object.entries(error.errors).map(([field, issue]) => [field, issue.message]),
    );
    return ApiError.unprocessable('The submitted data failed validation.', details);
  }

  if (error?.name === MONGOOSE_CAST) {
    return ApiError.badRequest(`\`${error.value}\` is not a valid value for ${error.path}.`);
  }

  // Two writes to the same document at the same time; the caller can retry.
  if (error?.name === MONGOOSE_VERSION) {
    return ApiError.conflict('This record changed while you were editing it. Reload and try again.');
  }

  if (error?.code === DUPLICATE_KEY) {
    const field = Object.keys(error.keyPattern ?? {})[0] ?? 'value';
    const labels = { email: 'email address', studentId: 'student ID' };
    return ApiError.conflict(`That ${labels[field] ?? field} is already in use.`, {
      [field]: `That ${labels[field] ?? field} is already in use.`,
    });
  }

  if (error?.name === 'JsonWebTokenError' || error?.name === 'TokenExpiredError') {
    return ApiError.unauthorized('Your session has expired. Please sign in again.');
  }

  // express.json() throws a SyntaxError for malformed payloads.
  if (error instanceof SyntaxError && 'body' in error) {
    return ApiError.badRequest('The request body is not valid JSON.');
  }

  // The database is unreachable, or a query was attempted while disconnected.
  // The client gets a plain 503 — never a driver message or a connection string.
  const connectionTrouble =
    /buffering timed out|before initial connection is complete|must be connected|not connected|connection is closed|topology was destroyed|server selection timed out/i;

  if (DATABASE_DOWN.has(error?.name) || connectionTrouble.test(error?.message ?? '')) {
    return ApiError.serviceUnavailable();
  }

  return new ApiError(500, 'Something went wrong on our end. Please try again.');
};

/**
 * Terminal error handler. Express 5 forwards rejected promises from async
 * route handlers here automatically, so controllers can stay async without a
 * bespoke wrapper.
 */
export const errorHandler = (error, req, res, _next) => {
  const apiError = normalise(error);

  if (apiError.statusCode === 501) {
    // Endpoints that are intentionally pending implementation are not faults.
    logger.warn('api', `${req.method} ${req.originalUrl} → 501 (not implemented yet)`);
  } else if (apiError.code === 'DATABASE_UNAVAILABLE') {
    // Already reported by the database layer; a stack trace here would just be
    // the same message repeated on every request.
    logger.warn('api', `${req.method} ${req.originalUrl} → 503 (database unavailable)`);
  } else if (apiError.statusCode >= 500) {
    logger.error('api', `${req.method} ${req.originalUrl} → ${apiError.statusCode}`, error.stack);
  }

  const body = {
    success: false,
    error: {
      code: apiError.code ?? 'INTERNAL_ERROR',
      message: apiError.message,
    },
  };

  if (apiError.details) body.error.details = apiError.details;

  // A stack trace is only ever attached to unexpected server faults, and never
  // in production. Operational conditions (503) are reported without internals.
  if (!env.isProduction && apiError.statusCode >= 500 && apiError.statusCode !== 503) {
    body.error.stack = error?.stack;
  }

  return res.status(apiError.statusCode).json(body);
};

