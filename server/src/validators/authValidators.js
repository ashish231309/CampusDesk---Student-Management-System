import { body } from 'express-validator';

/**
 * Shared field rules. They live in one place so the register and login chains
 * (added in the authentication stage) cannot drift apart.
 */
export const emailRule = body('email')
  .trim()
  .notEmpty()
  .withMessage('Email is required.')
  .bail()
  .isEmail()
  .withMessage('Please provide a valid email address.')
  .normalizeEmail();

export const passwordRule = body('password')
  .isString()
  .withMessage('Password is required.')
  .bail()
  .isLength({ min: 8, max: 72 })
  .withMessage('Password must be between 8 and 72 characters.')
  .bail()
  .matches(/[A-Za-z]/)
  .withMessage('Password must contain at least one letter.')
  .matches(/\d/)
  .withMessage('Password must contain at least one number.');

export const nameRule = body('name')
  .trim()
  .notEmpty()
  .withMessage('Name is required.')
  .bail()
  .isLength({ min: 2, max: 80 })
  .withMessage('Name must be between 2 and 80 characters.');
