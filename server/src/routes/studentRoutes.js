import { Router } from 'express';
import {
  createStudent,
  getStats,
  getStudent,
  listStudents,
  removeStudent,
  updateStudent,
} from '../controllers/studentController.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { validate } from '../middleware/validate.js';
import {
  createStudentRules,
  listStudentRules,
  studentIdParam,
  updateStudentRules,
} from '../validators/studentValidators.js';

const router = Router();

// The whole student area sits behind authentication.
router.use(requireAuth);

router.route('/').get(listStudentRules, validate, listStudents).post(createStudentRules, validate, createStudent);

// Declared before /:id so `stats` is never read as a student id.
router.get('/stats', getStats);

router
  .route('/:id')
  .get(studentIdParam, validate, getStudent)
  .patch(updateStudentRules, validate, updateStudent)
  .delete(studentIdParam, validate, removeStudent);

export default router;
