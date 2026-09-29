/**
 * Error type used across the API so every failure leaves the server with a
 * predictable shape: status code, machine-readable code and optional details.
 */
export class ApiError extends Error {
  constructor(statusCode, message, options = {}) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = options.code ?? null;
    this.details = options.details ?? null;
    this.isOperational = true;
    Error.captureStackTrace?.(this, ApiError);
  }

  static badRequest(message, details) {
    return new ApiError(400, message, { code: 'BAD_REQUEST', details });
  }

  static unauthorized(message = 'Authentication is required to access this resource.') {
    return new ApiError(401, message, { code: 'UNAUTHORIZED' });
  }

  static forbidden(message = 'You do not have permission to perform this action.', details) {
    return new ApiError(403, message, { code: 'FORBIDDEN', details });
  }

  static notFound(message = 'The requested resource could not be found.') {
    return new ApiError(404, message, { code: 'NOT_FOUND' });
  }

  static conflict(message, details) {
    return new ApiError(409, message, { code: 'CONFLICT', details });
  }

  static unprocessable(message = 'The submitted data failed validation.', details) {
    return new ApiError(422, message, { code: 'VALIDATION_ERROR', details });
  }

  /** Raised when MongoDB cannot be reached, so requests fail fast and clearly. */
  static serviceUnavailable(
    message = 'The database is unavailable right now. Please try again in a moment.',
  ) {
    return new ApiError(503, message, { code: 'DATABASE_UNAVAILABLE' });
  }

  /** Used by endpoints whose implementation lands in a later build stage. */
  static notImplemented(message = 'This endpoint is not available in the current build yet.') {
    return new ApiError(501, message, { code: 'NOT_IMPLEMENTED' });
  }
}
