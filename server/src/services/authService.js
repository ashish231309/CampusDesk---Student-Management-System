import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Account lookups shared by the authentication stage.
 *
 * Nothing here ever returns or logs a password; `findUserByEmail` only reads
 * the hash when a caller explicitly opts in (i.e. while verifying a login).
 */
export const findUserByEmail = (email, { withPassword = false } = {}) =>
  User.findOne({ email: email.toLowerCase().trim() }).select(withPassword ? '+passwordHash' : '');

export const findUserById = (id, { withPassword = false } = {}) =>
  User.findById(id).select(withPassword ? '+passwordHash' : '');

/** Duplicate email prevention — called before a new account is created. */
export const assertEmailIsAvailable = async (email) => {
  const existing = await User.exists({ email: email.toLowerCase().trim() });
  if (existing) {
    throw ApiError.conflict('That email address is already registered.', {
      email: 'That email address is already registered.',
    });
  }
};
