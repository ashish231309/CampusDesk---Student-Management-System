import {
  DEFAULT_SORT,
  PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
  STUDENT_YEARS,
  ENROLLMENT_STATUS_VALUES,
  SORT_OPTIONS,
} from '../constants/student.js';

/**
 * The register's list state ↔ URL, as pure functions.
 *
 * The URL is the single source of truth for search, filters, sort, page and
 * page size: the page reads its state from it and writes changes back to it.
 * That is what makes a filtered register shareable and reloadable, and it keeps
 * browser back/forward working without a second copy of the state in React.
 *
 * Reading is defensive. A hand-edited or out-of-date link can carry anything —
 * `?year=9th%20Year`, `?sort=passwordHash`, `?page=abc`, `?limit=100000` — and
 * none of it may reach the API or break the page. Every value is checked
 * against the same vocabulary the backend validates against, and anything that
 * does not fit falls back to its default.
 */

const SORT_VALUES = SORT_OPTIONS.map((option) => option.value);

export const LIST_DEFAULTS = Object.freeze({
  search: '',
  status: '',
  year: '',
  department: '',
  course: '',
  sort: DEFAULT_SORT,
  page: 1,
  limit: PAGE_SIZE,
});

const positiveInteger = (value, fallback) => {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
};

const oneOf = (value, allowed, fallback = '') => (allowed.includes(value) ? value : fallback);

/** Free-text values are trimmed and length-bounded; anything longer is dropped. */
const boundedText = (value, max = 120) => {
  const text = (value ?? '').trim();
  return text.length > 0 && text.length <= max ? text : '';
};

export const readStudentListQuery = (searchParams) => {
  const limit = positiveInteger(searchParams.get('limit'), LIST_DEFAULTS.limit);

  return {
    search: boundedText(searchParams.get('search')),
    status: oneOf(searchParams.get('status'), ENROLLMENT_STATUS_VALUES),
    year: oneOf(searchParams.get('year'), STUDENT_YEARS),
    department: boundedText(searchParams.get('department')),
    course: boundedText(searchParams.get('course')),
    sort: oneOf(searchParams.get('sort'), SORT_VALUES, LIST_DEFAULTS.sort),
    page: positiveInteger(searchParams.get('page'), LIST_DEFAULTS.page),
    limit: PAGE_SIZE_OPTIONS.includes(limit) ? limit : LIST_DEFAULTS.limit,
  };
};

/**
 * The URL a given state should produce. Defaults are omitted so a clean
 * register has a clean address, and every value is written the way the API
 * expects to receive it.
 */
export const writeStudentListQuery = (query) => {
  const params = new URLSearchParams();

  if (query.search) params.set('search', String(query.search).trim());
  if (query.status) params.set('status', query.status);
  if (query.year) params.set('year', query.year);
  if (query.department) params.set('department', query.department);
  if (query.course) params.set('course', query.course);

  if (query.sort && query.sort !== LIST_DEFAULTS.sort) params.set('sort', query.sort);
  if (query.limit && query.limit !== LIST_DEFAULTS.limit) params.set('limit', String(query.limit));
  if (query.page > 1) params.set('page', String(query.page));

  return params;
};

/** True when the stored URL differs from the cleaned-up version of itself. */
export const hasInvalidListParams = (searchParams) => {
  const cleaned = writeStudentListQuery(readStudentListQuery(searchParams));
  return cleaned.toString() !== new URLSearchParams(searchParams).toString();
};

/** Labels for the active-filter chips, in the order the controls appear. */
export const describeActiveFilters = (query) => {
  const sortLabel = SORT_OPTIONS.find((option) => option.value === query.sort)?.label;

  return [
    query.search && { key: 'search', label: `Search: ${query.search}` },
    query.status && { key: 'status', label: `Status: ${query.status === 'active' ? 'Active' : 'Inactive'}` },
    query.year && { key: 'year', label: query.year },
    query.department && { key: 'department', label: query.department },
    query.course && { key: 'course', label: query.course },
    sortLabel && query.sort !== LIST_DEFAULTS.sort && { key: 'sort', label: `Sort: ${sortLabel}` },
  ].filter(Boolean);
};

/** Any state that narrows or reorders the register. */
export const hasActiveListParams = (query) =>
  Boolean(
    query.search ||
      query.status ||
      query.year ||
      query.department ||
      query.course ||
      (query.sort && query.sort !== LIST_DEFAULTS.sort),
  );
