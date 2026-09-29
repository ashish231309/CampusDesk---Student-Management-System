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

export const SORT_OPTIONS = [
  { value: '-dateOfRegistration', label: 'Newest first' },
  { value: 'dateOfRegistration', label: 'Oldest first' },
  { value: 'name', label: 'Name A–Z' },
  { value: '-name', label: 'Name Z–A' },
  { value: 'studentId', label: 'Student ID' },
];

export const PAGE_SIZE = 8;
