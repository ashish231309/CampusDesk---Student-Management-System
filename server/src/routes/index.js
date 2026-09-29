import { Router } from 'express';
import authRoutes from './authRoutes.js';
import healthRoutes from './healthRoutes.js';
import studentRoutes from './studentRoutes.js';

/**
 * Versioned API surface. `/api` currently maps to v1; if a breaking change is
 * ever needed, mount the next router under `/api/v2` and keep this one alive.
 */
const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/students', studentRoutes);

/** Endpoint index — handy while developing against the API. */
router.get('/', (_req, res) => {
  res.json({
    success: true,
    data: {
      name: 'CampusDesk API',
      version: 'v1',
      endpoints: {
        health: ['GET /api/health', 'GET /api/health/ready'],
        auth: [
          'POST /api/auth/register',
          'POST /api/auth/login',
          'POST /api/auth/logout',
          'GET  /api/auth/me',
        ],
        students: [
          'GET    /api/students',
          'GET    /api/students/stats',
          'GET    /api/students/filters',
          'POST   /api/students',
          'GET    /api/students/:id',
          'PATCH  /api/students/:id',
          'DELETE /api/students/:id',
        ],
      },
    },
  });
});

export default router;
