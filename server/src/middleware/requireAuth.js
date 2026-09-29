import { ApiError } from '../utils/ApiError.js';
import { User } from '../models/User.js';
import { verifyAuthToken } from '../utils/token.js';

const readBearerToken = (req) => {
  const header = req.headers.authorization ?? '';
  if (!header.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  return token || null;
};

/**
 * Gate for everything behind a protected area.
 *
 * A token proves *who* the caller is; the role always comes from the account
 * record loaded here, never from the token's own claims, so a forged or edited
 * `role: "admin"` cannot elevate a staff account.
 *
 * Express 5 only forwards a rejected promise automatically — a middleware that
 * resolves is expected to have called `next()`. Missing that call stalls the
 * request instead of failing it, so the success path calls it explicitly.
 */
export const requireAuth = async (req, _res, next) => {
  const token = readBearerToken(req);
  if (!token) {
    throw ApiError.unauthorized('Authentication is required to access this resource.');
  }

  // An expired, malformed or wrongly-signed token throws here; the error
  // handler turns those into a 401 with a generic message.
  const payload = verifyAuthToken(token);
  const user = await User.findById(payload.sub);
  if (!user) {
    throw ApiError.unauthorized('This account no longer exists. Please sign in again.');
  }

  req.user = user;
  req.auth = { userId: user.id, role: user.role };

  next();
};
