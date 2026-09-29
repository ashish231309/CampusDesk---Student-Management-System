import { matchedData } from 'express-validator';
import { sendCreated, sendSuccess } from '../utils/response.js';
import { signAuthToken } from '../utils/token.js';
import { authenticateUser, registerUser } from '../services/authService.js';
import { env } from '../config/env.js';

/**
 * Authentication endpoints.
 *
 * Sign-in state is a bearer token the client stores and sends back as
 * `Authorization: Bearer <token>`. Tokens are stateless: the API can verify them
 * but cannot revoke an individual one before it expires, which is why sign-out
 * is a client-side operation (see `logout` below).
 */

/** Shape returned by register and login — never includes a password or hash. */
const session = (user) => ({
  user: user.toJSON(),
  token: signAuthToken(user),
  expiresIn: env.jwt.expiresIn,
});

/** POST /api/auth/register — public registration, always as a staff account. */
export const register = async (req, res) => {
  const payload = matchedData(req, { locations: ['body'] });
  const user = await registerUser(payload);
  return sendCreated(res, session(user));
};

/** POST /api/auth/login */
export const login = async (req, res) => {
  const credentials = matchedData(req, { locations: ['body'] });
  const user = await authenticateUser(credentials);
  return sendSuccess(res, session(user));
};

/**
 * POST /api/auth/logout
 *
 * CampusDesk issues stateless JWTs, so there is nothing on the server to
 * invalidate: the client discards the token and drops its cached user, and the
 * token becomes worthless to it. The endpoint exists so the client has one
 * place to call, and so a future token-revocation list can be added without the
 * client changing. It is intentionally unauthenticated and idempotent — signing
 * out with an already-expired token must still succeed.
 */
export const logout = (_req, res) =>
  sendSuccess(res, {
    message: 'You have been signed out. Discard the token on the client.',
    revokedOnServer: false,
  });

/** GET /api/auth/me — the safe profile behind a valid token. */
export const getCurrentUser = (req, res) => sendSuccess(res, { user: req.user.toJSON() });
