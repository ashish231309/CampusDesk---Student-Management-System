import { Router } from 'express';
import {
  getFilters,
  getStudent,
  getStats,
  getStudents,
  patchStudent,
  postStudent,
  removeStudent,
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

router
  .route('/')
  .get(listStudentRules, validate, getStudents)
  .post(createStudentRules, validate, postStudent);

// Declared before /:id so neither word is ever read as a student id.
router.get('/stats', getStats);
router.get('/filters', getFilters);

router
  .route('/:id')
  .get(studentIdParam, validate, getStudent)
  .patch(updateStudentRules, validate, patchStudent)
  .delete(studentIdParam, validate, removeStudent);

export default router;
