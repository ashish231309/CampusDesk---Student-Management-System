import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

/**
 * A tighter limiter for the endpoints that accept credentials, on top of the
 * broad application-wide one. It only ever affects `/api/auth/register` and
 * `/api/auth/login`, so normal API traffic keeps the generous global budget.
 *
 * The verification suite signs in dozens of times from one address, so the
 * limiter steps aside when `NODE_ENV=test` — production and development both
 * keep it.
 */
export const authRateLimit = rateLimit({
  windowMs: env.security.authRateLimit.windowMs,
  max: env.security.authRateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.isTest,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many sign-in attempts. Please wait a few minutes and try again.',
    },
  },
});
