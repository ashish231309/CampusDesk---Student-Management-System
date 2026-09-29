import { Student } from '../models/Student.js';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, STUDENT_SORT_FIELDS } from '../constants/student.js';

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Turn validated query parameters into a Mongoose filter.
 *
 * Pure on purpose: the student list endpoint and its tests can rely on it
 * without touching the database. `search` matches the fields a campus
 * administrator is most likely to have in front of them (name, student ID,
 * email, course, department).
 */
export const buildStudentQuery = ({ search, status, year, department } = {}) => {
  const query = {};

  const term = search?.trim();
  if (term) {
    const pattern = new RegExp(escapeRegExp(term), 'i');
    query.$or = [
      { name: pattern },
      { studentId: pattern },
      { email: pattern },
      { course: pattern },
      { department: pattern },
    ];
  }

  if (status) query.enrollmentStatus = status;
  if (year) query.year = year;
  if (department?.trim()) query.department = new RegExp(`^${escapeRegExp(department.trim())}$`, 'i');

  return query;
};

export const resolvePagination = ({ page = 1, limit = DEFAULT_PAGE_SIZE } = {}) => {
  const safeLimit = Math.min(Math.max(Number(limit) || DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
  const safePage = Math.max(Number(page) || 1, 1);
  return { page: safePage, limit: safeLimit, skip: (safePage - 1) * safeLimit };
};

export const resolveSort = (sort) =>
  STUDENT_SORT_FIELDS.includes(sort) ? sort.replace(/^(\w)/, '-$1') : '-dateOfRegistration';

/**
 * Paginated, searchable student list. Wired to the API in the student
 * management stage; the query shape is already final.
 */
export const listStudents = async (filters = {}) => {
  const query = buildStudentQuery(filters);
  const { page, limit, skip } = resolvePagination(filters);

  const [items, total] = await Promise.all([
    Student.find(query).sort(resolveSort(filters.sort)).skip(skip).limit(limit).lean(),
    Student.countDocuments(query),
  ]);

  return {
    items,
    meta: { page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1) },
  };
};

/** Numbers for the dashboard summary cards. */
export const getStudentStats = async () => {
  const [byStatus, byDepartment, byYear, total] = await Promise.all([
    Student.aggregate([{ $group: { _id: '$enrollmentStatus', count: { $sum: 1 } } }]),
    Student.aggregate([
      { $group: { _id: '$department', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]),
    Student.aggregate([{ $group: { _id: '$year', count: { $sum: 1 } } }]),
    Student.countDocuments(),
  ]);

  const pick = (rows, id) => rows.find((row) => row._id === id)?.count ?? 0;

  return {
    total,
    active: pick(byStatus, 'active'),
    inactive: pick(byStatus, 'inactive'),
    byDepartment: byDepartment.map((row) => ({ department: row._id ?? 'Unassigned', count: row.count })),
    byYear: byYear.map((row) => ({ year: row._id ?? 'Unknown', count: row.count })),
  };
};
