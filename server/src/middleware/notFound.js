import { ApiError } from '../utils/ApiError.js';

/** Any request that matched no route ends up here. */
export const notFound = (req, _res, next) => {
  next(ApiError.notFound(`No API route matches ${req.method} ${req.originalUrl}.`));
};
