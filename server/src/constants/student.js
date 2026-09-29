/**
 * Student domain constants shared by the models, validators and services.
 * Kept separate from the model file so validators do not have to import
 * Mongoose just to read a list of allowed values.
 */
export const STUDENT_YEARS = Object.freeze(['1st Year', '2nd Year', '3rd Year', '4th Year']);

export const ENROLLMENT_STATUSES = Object.freeze(['active', 'inactive']);

export const STUDENT_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const STUDENT_PHONE_PATTERN = /^[+]?[\d\s()-]{7,20}$/;

export const STUDENT_ID_PREFIX = 'CDS';

/** Query-string values the student list endpoint understands. */
export const STUDENT_SORT_FIELDS = Object.freeze([
  'name',
  '-name',
  'studentId',
  '-studentId',
  'dateOfRegistration',
  '-dateOfRegistration',
]);

export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 100;
