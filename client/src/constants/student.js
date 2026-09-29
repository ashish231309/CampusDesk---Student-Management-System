/**
 * Student domain options used by the tables, filters and forms.
 * Values match the API's validators exactly; labels are what users read.
 */

export const STUDENT_YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year'];

export const ENROLLMENT_STATUSES = [
  { value: 'active', label: 'Active', tone: 'success' },
  { value: 'inactive', label: 'Inactive', tone: 'neutral' },
];

export const ENROLLMENT_STATUS_VALUES = ENROLLMENT_STATUSES.map((status) => status.value);

export const ENROLLMENT_STATUS_LABELS = Object.fromEntries(
  ENROLLMENT_STATUSES.map((status) => [status.value, status.label]),
);

export const DEPARTMENTS = [
  'Computer Science',
  'Information Technology',
  'Electronics Engineering',
  'Mechanical Engineering',
  'Civil Engineering',
  'Business Administration',
  'Mathematics',
  'Physics',
];

/** Suggestions for the course field — the API accepts any course name. */
export const COURSE_SUGGESTIONS = [
  'B.Tech Computer Science',
  'B.Tech Information Technology',
  'B.Tech Electronics',
  'B.Tech Mechanical',
  'B.Tech Civil',
  'B.Sc Mathematics',
  'B.Sc Physics',
  'BBA',
];

/**
 * Sorting options. Every value here is one the API accepts (see
 * `SORTABLE_STUDENT_FIELDS` on the server) — the register never asks the API to
 * sort on a field it does not recognise.
 */
export const SORT_OPTIONS = [
  { value: '-dateOfRegistration', label: 'Newest first' },
  { value: 'dateOfRegistration', label: 'Oldest first' },
  { value: 'name', label: 'Name A–Z' },
  { value: '-name', label: 'Name Z–A' },
  { value: 'studentId', label: 'Student ID A–Z' },
  { value: '-studentId', label: 'Student ID Z–A' },
  { value: 'department', label: 'Department A–Z' },
  { value: '-year', label: 'Year (final first)' },
];

export const DEFAULT_SORT = SORT_OPTIONS[0].value;

/** Page sizes offered in the register. All within the API's 1–100 limit. */
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
export const PAGE_SIZE = PAGE_SIZE_OPTIONS[0];
