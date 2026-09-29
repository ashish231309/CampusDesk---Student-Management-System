import { matchedData } from 'express-validator';
import {
  createStudent,
  deleteStudent,
  getStudentById,
  getStudentFilterOptions,
  getStudentStats,
  listStudents,
  updateStudent,
} from '../services/studentService.js';
import { sendCreated, sendSuccess } from '../utils/response.js';

/**
 * Controllers stay thin: validated input in, service call, standard envelope
 * out. All business rules live in `services/studentService.js`.
 *
 * Input is read through `matchedData`, which returns the values the validation
 * chains already trimmed and coerced. Express 5 exposes `req.query` as a lazily
 * re-parsed getter, so reading it directly would hand the service the raw,
 * untrimmed query string.
 */

/** GET /api/students */
export const getStudents = async (req, res) => {
  const filters = matchedData(req, { locations: ['query'] });
  const result = await listStudents(filters);

  return sendSuccess(res, { students: result.items }, { meta: result.meta });
};

/** GET /api/students/stats */
export const getStats = async (_req, res) => {
  const stats = await getStudentStats();
  return sendSuccess(res, { stats });
};

/** GET /api/students/filters — values the register's filter controls can offer. */
export const getFilters = async (_req, res) => {
  const options = await getStudentFilterOptions();
  return sendSuccess(res, { options });
};

/** GET /api/students/:id */
export const getStudent = async (req, res) => {
  const student = await getStudentById(req.params.id);
  return sendSuccess(res, { student });
};

/** POST /api/students */
export const postStudent = async (req, res) => {
  const student = await createStudent(matchedData(req, { locations: ['body'] }));
  return sendCreated(res, { student });
};

/** PATCH /api/students/:id */
export const patchStudent = async (req, res) => {
  const student = await updateStudent(req.params.id, matchedData(req, { locations: ['body'] }), {
    role: req.auth?.role,
  });

  return sendSuccess(res, { student });
};

/** DELETE /api/students/:id */
export const removeStudent = async (req, res) => {
  const student = await deleteStudent(req.params.id);
  return sendSuccess(res, { student, deleted: true });
};
