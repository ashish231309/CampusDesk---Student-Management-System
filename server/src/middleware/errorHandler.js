import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';

const MONGOOSE_VALIDATION = 'ValidationError';
const MONGOOSE_CAST = 'CastError';
const DUPLICATE_KEY = 11000;

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
  if (!env.isProduction && apiError.statusCode >= 500) body.error.stack = error?.stack;

  return res.status(apiError.statusCode).json(body);
};

