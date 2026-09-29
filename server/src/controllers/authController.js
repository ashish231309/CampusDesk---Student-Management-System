import { ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/response.js';

/**
 * Authentication endpoints land in their own build stage. The routes and their
 * validation chains already exist, so that stage only has to replace the bodies
 * of these handlers — no restructuring of the API surface is required.
 */

/** POST /api/auth/register */
export const register = () => {
  throw ApiError.notImplemented('Account registration arrives in the authentication stage.');
};

/** POST /api/auth/login */
export const login = () => {
  throw ApiError.notImplemented('Sign in arrives in the authentication stage.');
};

/** POST /api/auth/logout */
export const logout = () => {
  throw ApiError.notImplemented('Sign out arrives in the authentication stage.');
};

/** GET /api/auth/me — used to restore the session after a page reload. */
export const getCurrentUser = (req, res) => sendSuccess(res, { user: req.user.toJSON() });
