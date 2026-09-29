import { body } from 'express-validator';
import {
  DEFAULT_REGISTRATION_ROLE,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  REGISTRATION_PROTECTED_FIELDS,
} from '../constants/auth.js';

/**
 * Field rules shared by the sign-in and registration chains. They live in one
 * place so the two cannot drift apart, and each chain is exported as a whole so
 * a route can never forget one of them.
 */

export const nameRule = body('name')
  .trim()
  .notEmpty()
  .withMessage('Name is required.')
  .bail()
  .isLength({ min: 2, max: 80 })
  .withMessage('Name must be between 2 and 80 characters.');

export const emailRule = body('email')
  .trim()
  .notEmpty()
  .withMessage('Email is required.')
  .bail()
  .isEmail()
  .withMessage('Please provide a valid email address.')
  .normalizeEmail();

/**
 * Registration asks for a password that is long enough to be worth storing and
 * that mixes letters with digits. The rules stop there on purpose — long
 * passphrases with no symbols are perfectly good passwords.
 */
export const registerPasswordRule = body('password')
  .isString()
  .withMessage('Password is required.')
  .bail()
  .isLength({ min: PASSWORD_MIN_LENGTH, max: PASSWORD_MAX_LENGTH })
  .withMessage(`Password must be between ${PASSWORD_MIN_LENGTH} and ${PASSWORD_MAX_LENGTH} characters.`)
  .bail()
  .matches(/[A-Za-z]/)
  .withMessage('Password must contain at least one letter.')
  .matches(/\d/)
  .withMessage('Password must contain at least one number.');

/**
 * Sign-in deliberately does *not* re-check password strength: an account made
 * before the policy changed must still be able to sign in, and echoing the
 * policy back on a failed login would leak it. Anything non-empty is compared.
 */
export const loginPasswordRule = body('password')
  .isString()
  .withMessage('Password is required.')
  .bail()
  .notEmpty()
  .withMessage('Password is required.')
  .bail()
  .isLength({ max: PASSWORD_MAX_LENGTH })
  .withMessage(`Password must be ${PASSWORD_MAX_LENGTH} characters or fewer.`);

/**
 * Accounts are created as staff. Roles, timestamps and the password hash belong
 * to CampusDesk, so a registration that sends one is rejected explicitly —
 * silently ignoring `role: "admin"` would leave the caller thinking it worked.
 */
const rejectManagedFields = () =>
  REGISTRATION_PROTECTED_FIELDS.map((field) =>
    body(field)
      .custom((value) => value === undefined || value === null)
      .withMessage((_value, { path }) =>
        path === 'role'
          ? `Accounts are created as ${DEFAULT_REGISTRATION_ROLE}. Ask an administrator to change a role.`
          : `\`${path}\` is managed by CampusDesk and cannot be provided.`,
      ),
  );

export const registerRules = [nameRule, emailRule, registerPasswordRule, ...rejectManagedFields()];

export const loginRules = [emailRule, loginPasswordRule];
