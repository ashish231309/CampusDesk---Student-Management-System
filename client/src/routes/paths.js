import { readStudentListQuery, writeStudentListQuery } from '../utils/studentQuery.js';

/** Every route in the app, in one place, so links never drift from the router. */
export const paths = {
  home: '/',
  login: '/login',
  register: '/register',
  dashboard: '/dashboard',
  students: '/students',
  newStudent: '/students/new',
  student: (id = ':id') => `/students/${id}`,
  editStudent: (id = ':id') => `/students/${id}/edit`,
};

export const notFound = '*';

/**
 * A link to the register in a given state — used by the dashboard to open the
 * register already narrowed to the students a figure describes.
 *
 * It serialises through the same canonical writer the register itself uses, so a
 * link from the dashboard is exactly the URL the register would have produced:
 * defaults omitted, every value encoded, and anything the register would refuse
 * never written in the first place. There is no second query format.
 */
export const studentRegisterHref = (query = {}) => {
  // Written, then read back through the register's own reader and written
  // again: a link is only ever produced in the shape the register accepts, so a
  // caller cannot invent a filter value, an out-of-range page size or a sort the
  // API would refuse. Valid states survive untouched — this normalises, it does
  // not reinterpret.
  const canonical = writeStudentListQuery(readStudentListQuery(writeStudentListQuery(query)));
  const search = canonical.toString();
  return search ? `${paths.students}?${search}` : paths.students;
};
