import { Router } from 'express';
import { getCurrentUser, login, logout, register } from '../controllers/authController.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { validate } from '../middleware/validate.js';
import { emailRule, nameRule, passwordRule } from '../validators/authValidators.js';

const router = Router();

router.post('/register', [nameRule, emailRule, passwordRule], validate, register);
router.post('/login', [emailRule, passwordRule], validate, login);
router.post('/logout', logout);

/** Session bootstrap for the client after a refresh. */
router.get('/me', requireAuth, getCurrentUser);

export default router;
