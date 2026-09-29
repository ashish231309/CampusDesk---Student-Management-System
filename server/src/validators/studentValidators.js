import { body, param, query } from 'express-validator';
import { ENROLLMENT_STATUSES, STUDENT_YEARS } from '../constants/student.js';
import { STUDENT_EMAIL_PATTERN, STUDENT_PHONE_PATTERN } from '../constants/student.js';

/**
 * Rules are declared as factories so the create and update chains each get
 * their own validator instances — reusing one instance and calling `.optional()`
 * on it would silently loosen the create rules too.
 */
const name = () =>
  body('name').trim().notEmpty().withMessage('Student name is required.')
    .bail().isLength({ min: 2, max: 120 })
    .withMessage('Student name must be between 2 and 120 characters.');

const email = () =>
  body('email').trim().notEmpty().withMessage('Email is required.')
    .bail().matches(STUDENT_EMAIL_PATTERN).withMessage('Please provide a valid email address.')
    .normalizeEmail();

const phone = () =>
  body('phone').trim().notEmpty().withMessage('Phone number is required.')
    .bail().matches(STUDENT_PHONE_PATTERN).withMessage('Please provide a valid phone number.');

const course = () =>
  body('course').trim().notEmpty().withMessage('Course is required.')
    .bail().isLength({ max: 120 }).withMessage('Course cannot exceed 120 characters.');

const year = () =>
  body('year').trim().notEmpty().withMessage('Year of study is required.')
    .bail().isIn(STUDENT_YEARS).withMessage(`Year must be one of: ${STUDENT_YEARS.join(', ')}.`);

const department = () =>
  body('department').trim().notEmpty().withMessage('Department is required.')
    .bail().isLength({ max: 120 }).withMessage('Department cannot exceed 120 characters.');

const dateOfRegistration = () =>
  body('dateOfRegistration').optional({ values: 'falsy' }).isISO8601()
    .withMessage('Date of registration must be a valid date.').toDate();

const enrollmentStatus = () =>
  body('enrollmentStatus').optional({ values: 'falsy' }).trim()
    .isIn(ENROLLMENT_STATUSES)
    .withMessage(`Status must be one of: ${ENROLLMENT_STATUSES.join(', ')}.`);

const avatarUrl = () =>
  body('avatarUrl').optional({ values: 'falsy' }).trim().isURL()
    .withMessage('Profile photo must be a valid URL.');

const optional = (rules) => rules.map((rule) => rule.optional({ values: 'undefined' }));

const mongoId = (field = 'id') =>
  param(field).trim().notEmpty().withMessage('A student id is required.')
    .bail().isMongoId().withMessage('That student id is not valid.');

export const studentIdParam = [mongoId()];

export const createStudentRules = [
  name(),
  email(),
  phone(),
  course(),
  year(),
  department(),
  dateOfRegistration(),
  enrollmentStatus(),
  avatarUrl(),
];

export const updateStudentRules = [
  mongoId(),
  ...optional([name(), email(), phone(), course(), year(), department(), dateOfRegistration(), enrollmentStatus(), avatarUrl()]),
];

/** Query rules for the search / filter / pagination endpoint. */
export const listStudentRules = [
  query('search').optional().trim().isLength({ max: 120 })
    .withMessage('Search term is too long.'),
  query('status').optional().trim().isIn(ENROLLMENT_STATUSES)
    .withMessage(`Status must be one of: ${ENROLLMENT_STATUSES.join(', ')}.`),
  query('year').optional().trim().isIn(STUDENT_YEARS)
    .withMessage(`Year must be one of: ${STUDENT_YEARS.join(', ')}.`),
  query('department').optional().trim().isLength({ max: 120 }),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be 1 or greater.').toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100.').toInt(),
  query('sort').optional().trim().isLength({ max: 40 }),
];
