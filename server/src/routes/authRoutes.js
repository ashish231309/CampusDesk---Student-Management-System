import { Router } from 'express';
import { getCurrentUser, login, logout, register } from '../controllers/authController.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { validate } from '../middleware/validate.js';
import { authRateLimit } from '../middleware/rateLimit.js';
import { loginRules, registerRules } from '../validators/authValidators.js';

const router = Router();

// Credential endpoints get the tighter limiter; sign-out does not need one.
router.post('/register', authRateLimit, registerRules, validate, register);
router.post('/login', authRateLimit, loginRules, validate, login);
router.post('/logout', logout);

/** Session bootstrap for the client after a refresh. */
router.get('/me', requireAuth, getCurrentUser);

export default router;
