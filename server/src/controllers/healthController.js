import { getDatabaseState } from '../config/db.js';
import { env } from '../config/env.js';
import { sendSuccess } from '../utils/response.js';

/** Liveness probe for the API itself. */
export const getHealth = (_req, res) =>
  sendSuccess(res, {
    status: 'ok',
    service: 'campusdesk-api',
    environment: env.nodeEnv,
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });

/** Readiness probe including the database connection. */
export const getReadiness = (_req, res) => {
  const database = getDatabaseState();
  return sendSuccess(res, {
    status: database.isConnected ? 'ready' : 'degraded',
    database,
  });
};
