/**
 * Student domain constants shared by the models, validators, services and the
 * API documentation. Kept separate from the model file so validators do not
 * have to import Mongoose just to read a list of allowed values.
 */

export const STUDENT_YEARS = Object.freeze(['1st Year', '2nd Year', '3rd Year', '4th Year']);

export const ENROLLMENT_STATUSES = Object.freeze(['active', 'inactive']);

export const STUDENT_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const STUDENT_PHONE_PATTERN = /^[+]?[\d\s()-]{7,20}$/;

export const STUDENT_ID_PREFIX = 'CDS';

/** Canonical generated identifier, e.g. CDS-2026-0042. */
export const STUDENT_ID_PATTERN = /^CDS-\d{4}-\d{4,}$/;

/**
 * Fields the API accepts when creating or updating a student.
 * Anything outside this list is ignored, which keeps mass assignment out of
 * reach (studentId, _id, timestamps and friends are never client-controlled).
 */
export const STUDENT_EDITABLE_FIELDS = Object.freeze([
  'name',
  'email',
  'phone',
  'course',
  'year',
  'department',
  'dateOfRegistration',
  'enrollmentStatus',
  'avatarUrl',
]);

/** Rejected outright if a client tries to send them. */
export const STUDENT_PROTECTED_FIELDS = Object.freeze([
  'studentId',
  'id',
  '_id',
  'createdAt',
  'updatedAt',
  '__v',
]);

/**
 * Fields the register can be sorted by. Only these are accepted: allowing an
 * arbitrary field name would let a caller sort on data we never intended to
 * expose and would defeat the indexes.
 */
export const SORTABLE_STUDENT_FIELDS = Object.freeze([
  'name',
  'studentId',
  'email',
  'course',
  'year',
  'department',
  'dateOfRegistration',
  'createdAt',
]);

/** Accepted `sort` query values: the bare field, or `-field` for descending. */
export const STUDENT_SORT_FIELDS = Object.freeze(
  SORTABLE_STUDENT_FIELDS.flatMap((field) => [field, `-${field}`]),
);

export const STUDENT_SORT_DIRECTIONS = Object.freeze(['asc', 'desc']);

export const DEFAULT_STUDENT_SORT_FIELD = 'dateOfRegistration';
export const DEFAULT_STUDENT_SORT_DIRECTION = 'desc';

export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 100;

/** Free-text search is capped so a query cannot be used as a DoS vector. */
export const MAX_SEARCH_LENGTH = 120;
