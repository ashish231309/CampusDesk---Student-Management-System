import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import {
  DEFAULT_REGISTRATION_ROLE,
  INVALID_CREDENTIALS_MESSAGE,
} from '../constants/auth.js';

/**
 * Account lookups and the two operations that create or verify a sign-in.
 *
 * Nothing here ever returns or logs a password; `findUserByEmail` only reads the
 * hash when a caller explicitly opts in (i.e. while verifying a login).
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

/**
 * A hash of a throwaway string, compared against when no account matches the
 * submitted email. It keeps a failed login for an unknown address roughly as
 * slow as one for a known address, so response timing does not reveal which
 * email addresses exist. It is not a secret and never matches a real password.
 */
const TIMING_EQUALISER_HASH = '$2b$10$H2WhIjCFgxsrOf63H3erwuo3yTd7VkleqCR2apa.W2L.ljuCRtH.6';

/**
 * Create an account from a public registration.
 *
 * The role is assigned here, never taken from the request: the validators reject
 * a supplied `role`, and this default is the only way one is set. The plaintext
 * goes through the User model's `password` virtual, which hashes it before it is
 * persisted, so the service never handles the hash itself.
 */
export const registerUser = async ({ name, email, password }) => {
  const normalisedEmail = email.toLowerCase().trim();
  await assertEmailIsAvailable(normalisedEmail);

  const user = new User({ name, email: normalisedEmail, role: DEFAULT_REGISTRATION_ROLE });
  user.password = password;
  await user.save();

  return user;
};

/**
 * Verify credentials and return the account.
 *
 * A missing account and a wrong password produce the same 401 with the same
 * message, so the endpoint cannot be used to enumerate registered addresses.
 */
export const authenticateUser = async ({ email, password }) => {
  const user = await findUserByEmail(email, { withPassword: true });
  const matches = await bcrypt.compare(
    password,
    user?.passwordHash ?? TIMING_EQUALISER_HASH,
  );

  if (!user || !matches) {
    throw ApiError.unauthorized(INVALID_CREDENTIALS_MESSAGE);
  }

  user.lastLoginAt = new Date();
  await user.save();

  return user;
};
