import { ApiError } from '../utils/ApiError.js';

/**
 * Student CRUD lands in the student management stage. The route table, the
 * validation chains and the service layer are already in place, so the work
 * left there is filling in these handlers.
 */

/** GET /api/students */
export const listStudents = () => {
  throw ApiError.notImplemented('Listing students arrives in the student management stage.');
};

/** GET /api/students/stats */
export const getStats = () => {
  throw ApiError.notImplemented('Dashboard statistics arrive in the student management stage.');
};

/** GET /api/students/:id */
export const getStudent = () => {
  throw ApiError.notImplemented('Student details arrive in the student management stage.');
};

/** POST /api/students */
export const createStudent = () => {
  throw ApiError.notImplemented('Adding students arrives in the student management stage.');
};

/** PATCH /api/students/:id */
export const updateStudent = () => {
  throw ApiError.notImplemented('Editing students arrives in the student management stage.');
};

/** DELETE /api/students/:id */
export const removeStudent = () => {
  throw ApiError.notImplemented('Removing students arrives in the student management stage.');
};
