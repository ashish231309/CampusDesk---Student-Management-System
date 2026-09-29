import { validationResult } from 'express-validator';
import { ApiError } from '../utils/ApiError.js';

/**
 * Runs after a chain of express-validator checks and turns the result into a
 * single 422 response whose `details` map mirrors the form fields, so the
 * frontend can highlight the exact input that needs attention.
 */
export const validate = (req, _res, next) => {
  const result = validationResult(req);
  if (result.isEmpty()) return next();

  const details = {};
  for (const error of result.array()) {
    // Validators that apply to the whole body report an empty path.
    const field = error.path || 'form';
    if (!details[field]) details[field] = error.msg;
  }

  return next(ApiError.unprocessable('The submitted data failed validation.', details));
};
