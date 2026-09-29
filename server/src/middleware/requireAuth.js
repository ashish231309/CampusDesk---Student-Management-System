import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { User } from '../models/User.js';

const readBearerToken = (req) => {
  const header = req.headers.authorization ?? '';
  if (!header.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  return token || null;
};

/**
 * Gate for everything behind a protected area.
 *
 * Verification is complete and final; the endpoints that *issue* tokens
 * (register / login) arrive in the authentication stage, which is why an
 * anonymous request currently ends in 401 instead of a list of students.
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

  const payload = jwt.verify(token, env.jwt.secret);
  const user = await User.findById(payload.sub);
  if (!user) {
    throw ApiError.unauthorized('This account no longer exists. Please sign in again.');
  }

  req.user = user;
  req.auth = { userId: user.id, role: user.role };

  next();
};
