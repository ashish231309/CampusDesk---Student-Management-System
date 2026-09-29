import mongoose from 'mongoose';
import { Student } from '../models/Student.js';
import { ApiError } from '../utils/ApiError.js';
import {
  DEFAULT_PAGE_SIZE,
  DEFAULT_STUDENT_SORT_DIRECTION,
  DEFAULT_STUDENT_SORT_FIELD,
  MAX_FILTER_OPTIONS,
  MAX_PAGE_SIZE,
  MAX_SEARCH_LENGTH,
  MAX_SEARCH_TERMS,
  SORTABLE_STUDENT_FIELDS,
  STUDENT_EDITABLE_FIELDS,
  ENROLLMENT_STATUSES,
  STUDENT_YEARS,
} from '../constants/student.js';

const DUPLICATE_KEY = 11000;
/** A generated ID can only collide if the counter drifted from the data; a few
 * attempts take the next numbers before giving up. */
const MAX_ID_ATTEMPTS = 5;

/** Regex metacharacters in user input must never reach the query engine raw. */
export const escapeRegExp = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const exactCaseInsensitive = (value) => new RegExp(`^${escapeRegExp(value.trim())}$`, 'i');

/**
 * Phone numbers are stored the way an administrator typed them ("+91 98220
 * 41182"), so a digits-only search has to tolerate the separators. Returns no
 * patterns for input that does not look like a phone number.
 */
export const buildPhonePatterns = (term = '') => {
  const digits = term.replace(/\D/g, '');
  if (digits.length < 3) return [];
  const flexible = digits
    .split('')
    .map((digit) => escapeRegExp(digit))
    .join('[\\s()+-]*');
  return [new RegExp(flexible, 'i')];
};

/**
 * Split a search string into at most `MAX_SEARCH_TERMS` terms.
 *
 * Duplicates are dropped, so "ashish ashish" costs one branch rather than two.
 */
export const splitSearchTerms = (search = '') =>
  [...new Set(String(search).trim().split(/\s+/).filter(Boolean))].slice(0, MAX_SEARCH_TERMS);

/**
 * The conditions that satisfy a single search term: a case-insensitive
 * substring match on each searchable field, plus a separator-tolerant phone
 * match when the term looks like a number. Every value is regex-escaped, so a
 * caller cannot inject pattern syntax.
 */
const termConditions = (term) => {
  const pattern = new RegExp(escapeRegExp(term), 'i');

  return [
    { name: pattern },
    { studentId: pattern },
    { email: pattern },
    { course: pattern },
    { department: pattern },
    ...buildPhonePatterns(term).map((phonePattern) => ({ phone: phonePattern })),
  ];
};

/**
 * Turn validated query parameters into a Mongoose filter.
 *
 * Pure on purpose: the list endpoint, the verification suite and any future
 * exporter can rely on it without touching the database.
 *
 * Search spans the fields an administrator actually has in front of them —
 * name, student ID, email, phone, course and department — and is matched with
 * these rules:
 *
 *   • a single term matches any one of those fields ("98220" finds a phone);
 *   • multiple terms are ANDed, each of them matching some field, so
 *     "ashish kumar" finds a student recorded as "Kumar, Ashish" and
 *     "cse 2026" finds record 2026 in the CSE department;
 *   • matching is case-insensitive substring matching, not word-prefix or
 *     fuzzy matching: "sha" finds "Sharma" but "srma" does not;
 *   • digits are matched loosely against the stored phone, so 9822012345,
 *     98220 12345 and +91 98220 12345 all find the same record.
 *
 * It stays deliberately narrow: bounded length, bounded term count, escaped
 * metacharacters, no operator objects from the client, and no field outside the
 * list above.
 */
export const buildStudentQuery = ({ search, status, year, department, course } = {}) => {
  const query = {};
  const terms = splitSearchTerms(search?.slice(0, MAX_SEARCH_LENGTH));

  if (terms.length === 1) {
    query.$or = termConditions(terms[0]);
  } else if (terms.length > 1) {
    // Every term must match something, but not necessarily the same field.
    query.$and = terms.map((term) => ({ $or: termConditions(term) }));
  }

  if (status) query.enrollmentStatus = status;
  if (year) query.year = year;
  if (department?.trim()) query.department = exactCaseInsensitive(department);
  if (course?.trim()) query.course = exactCaseInsensitive(course);

  return query;
};

/**
 * Values for the register's filter controls.
 *
 * Courses and departments are free-form in this application — the form accepts
 * any name an administrator types — so the options are read back from the data
 * rather than kept as a list that goes stale the moment someone enters a new
 * course. The fixed vocabularies (years, enrollment statuses) come from the
 * same constants the validators use, so a value offered by the UI is always a
 * value the API accepts.
 *
 * `distinct` with no filter scans the collection, so the result is sorted and
 * capped, and the endpoint is called once per visit rather than per keystroke.
 */
export const getStudentFilterOptions = async () => {
  const [courses, departments] = await Promise.all([
    Student.distinct('course'),
    Student.distinct('department'),
  ]);

  /**
   * Trim, drop blanks, collapse case-insensitive duplicates — `CSE` and `cse`
   * are the same department as far as filtering is concerned, because the filter
   * itself matches case-insensitively — then sort and bound the list.
   */
  const clean = (values) => {
    const seen = new Map();

    for (const value of values) {
      if (typeof value !== 'string') continue;
      const text = value.trim();
      if (!text) continue;
      const key = text.toLowerCase();
      if (!seen.has(key)) seen.set(key, text);
    }

    return [...seen.values()].sort((a, b) => a.localeCompare(b)).slice(0, MAX_FILTER_OPTIONS);
  };

  return {
    courses: clean(courses),
    departments: clean(departments),
    years: [...STUDENT_YEARS],
    statuses: [...ENROLLMENT_STATUSES],
    sortFields: [...SORTABLE_STUDENT_FIELDS],
  };
};

export const resolvePagination = ({ page = 1, limit = DEFAULT_PAGE_SIZE } = {}) => {
  const safeLimit = Math.min(Math.max(Number(limit) || DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
  const safePage = Math.max(Number(page) || 1, 1);
  return { page: safePage, limit: safeLimit, skip: (safePage - 1) * safeLimit };
};

/**
 * Resolve the sort clause from `sort` (field name, optionally prefixed with
 * `-`) and `order` (asc|desc). Only whitelisted fields are honoured; anything
 * else falls back to the register's default. `sort=name&order=desc` and
 * `sort=-name` mean the same thing.
 */
export const resolveSort = (sort, order) => {
  const raw = typeof sort === 'string' ? sort.trim() : '';

  // `sort=-name` and `sort=name&order=desc` mean the same thing.
  const descendingByPrefix = raw.startsWith('-');
  const field = descendingByPrefix ? raw.slice(1) : raw;

  if (!SORTABLE_STUDENT_FIELDS.includes(field)) {
    return {
      field: DEFAULT_STUDENT_SORT_FIELD,
      direction: DEFAULT_STUDENT_SORT_DIRECTION,
      clause: `-${DEFAULT_STUDENT_SORT_FIELD}`,
    };
  }

  const direction = descendingByPrefix || order === 'desc' ? 'desc' : 'asc';

  return {
    field,
    direction,
    clause: direction === 'desc' ? `-${field}` : field,
  };
};

/** Pagination metadata shared by every collection endpoint. */
export const buildPageMeta = (page, limit, total, sort) => {
  const totalPages = Math.max(Math.ceil(total / limit), 1);
  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
    ...(sort ? { sort } : {}),
  };
};

/** Only fields the API owns are ever written — no mass assignment. */
const pickStudentFields = (payload = {}) =>
  Object.fromEntries(
    STUDENT_EDITABLE_FIELDS.filter((field) => payload[field] !== undefined).map((field) => [
      field,
      payload[field],
    ]),
  );

const isDuplicateKeyOn = (error, field) =>
  error?.code === DUPLICATE_KEY && Object.keys(error.keyPattern ?? {}).includes(field);

const findStudentOrFail = async (id) => {
  if (!mongoose.isValidObjectId(id)) {
    throw ApiError.badRequest('That student id is not valid.');
  }

  const student = await Student.findById(id);
  if (!student) {
    throw ApiError.notFound('No student matches that id.');
  }

  return student;
};

/** Paginated, searchable, filterable and sortable register. */
export const listStudents = async (filters = {}) => {
  const query = buildStudentQuery(filters);
  const { page, limit, skip } = resolvePagination(filters);
  const sort = resolveSort(filters.sort, filters.order);

  const [items, total] = await Promise.all([
    // Documents (not lean) so list items and a single student share exactly the
    // same JSON shape, virtuals included.
    Student.find(query).sort(sort.clause).skip(skip).limit(limit),
    Student.countDocuments(query),
  ]);

  return {
    items,
    meta: buildPageMeta(page, limit, total, { field: sort.field, direction: sort.direction }),
  };
};

/**
 * Everything the dashboard needs, in one round trip: status split, department
 * and year distribution, and the most recent registrations.
 */
export const getStudentStats = async () => {
  const [result] = await Student.aggregate([
    {
      $facet: {
        byStatus: [{ $group: { _id: '$enrollmentStatus', count: { $sum: 1 } } }],
        byDepartment: [
          { $group: { _id: '$department', count: { $sum: 1 } } },
          { $sort: { count: -1, _id: 1 } },
        ],
        byYear: [
          { $group: { _id: '$year', count: { $sum: 1 } } },
          { $sort: { _id: 1 } },
        ],
        total: [{ $count: 'value' }],
        recentRegistrations: [
          { $sort: { dateOfRegistration: -1, createdAt: -1 } },
          { $limit: 5 },
          {
            $project: {
              studentId: 1,
              name: 1,
              email: 1,
              course: 1,
              year: 1,
              department: 1,
              enrollmentStatus: 1,
              dateOfRegistration: 1,
              avatarUrl: 1,
            },
          },
        ],
      },
    },
  ]);

  const rows = result ?? {};
  const pick = (list, id) => list.find((row) => row._id === id)?.count ?? 0;

  return {
    total: rows.total?.[0]?.value ?? 0,
    active: pick(rows.byStatus ?? [], 'active'),
    inactive: pick(rows.byStatus ?? [], 'inactive'),
    byDepartment: (rows.byDepartment ?? []).map((row) => ({
      department: row._id ?? 'Unassigned',
      count: row.count,
    })),
    byYear: (rows.byYear ?? []).map((row) => ({ year: row._id ?? 'Unknown', count: row.count })),
    recentRegistrations: (rows.recentRegistrations ?? []).map(({ _id, ...rest }) => ({
      id: String(_id),
      ...rest,
    })),
  };
};

/**
 * Create a student. The client never supplies a student ID — the model's
 * pre-validate hook allocates one atomically.
 */
export const createStudent = async (payload = {}) => {
  const data = pickStudentFields(payload);

  for (let attempt = 1; attempt <= MAX_ID_ATTEMPTS; attempt += 1) {
    try {
      return await Student.create(data);
    } catch (error) {
      const canRetry = isDuplicateKeyOn(error, 'studentId') && attempt < MAX_ID_ATTEMPTS;
      if (!canRetry) throw error;
    }
  }

  throw ApiError.conflict('CampusDesk could not allocate a unique student ID. Please try again.');
};

export const getStudentById = (id) => findStudentOrFail(id);

/**
 * Update a student.
 *
 * The student ID is immutable and the registration date is an administrative
 * fact, so changing it requires an administrator: anyone else gets a clear 403
 * rather than a silently ignored field.
 */
export const updateStudent = async (id, payload = {}, { role } = {}) => {
  const student = await findStudentOrFail(id);
  const changes = pickStudentFields(payload);

  if (changes.dateOfRegistration !== undefined) {
    const next = new Date(changes.dateOfRegistration);
    const current = student.dateOfRegistration ?? null;
    const isSameMoment = current !== null && next.getTime() === current.getTime();

    if (!isSameMoment && role !== 'admin') {
      throw ApiError.forbidden(
        'Only an administrator can change the date of registration.',
        { dateOfRegistration: 'Only an administrator can change the date of registration.' },
      );
    }
  }

  Object.assign(student, changes);
  await student.save();
  return student;
};

/** Delete a student, returning the removed record for the API response. */
export const deleteStudent = async (id) => {
  const student = await findStudentOrFail(id);
  await student.deleteOne();
  return student;
};
