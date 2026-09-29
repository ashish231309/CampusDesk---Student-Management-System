/**
 * Authentication constants shared by the model, the validators and the service,
 * so the rules cannot drift apart between layers.
 */

/** Roles an account can hold. Mirrors the enum on the User model. */
export const USER_ROLES = Object.freeze(['admin', 'staff']);

/**
 * Public registration always creates this role.
 *
 * Nothing in a registration request can change it — an administrator creates
 * another administrator through the database or an administrative endpoint, not
 * by asking the public form nicely. Keeping the safe value here means the model
 * and the service cannot disagree about it.
 */
export const DEFAULT_REGISTRATION_ROLE = 'staff';

/** bcrypt only reads the first 72 bytes, so longer passwords are meaningless. */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72;

/**
 * Fields the application manages itself. A public registration that sends one
 * gets an explicit error rather than having the value silently ignored.
 */
export const REGISTRATION_PROTECTED_FIELDS = Object.freeze([
  'role',
  'passwordHash',
  'lastLoginAt',
  '_id',
  'id',
  'createdAt',
  'updatedAt',
]);

/**
 * One message for "no such account" and "wrong password", so the API cannot be
 * used to discover which email addresses are registered.
 */
export const INVALID_CREDENTIALS_MESSAGE = 'The email address or password is incorrect.';
