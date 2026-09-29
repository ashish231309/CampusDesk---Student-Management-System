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

/**
 * Readiness probe including the database connection.
 *
 * The body always keeps the standard envelope; the status code is what a
 * monitor or load balancer acts on — 200 when the API can serve data, 503 when
 * it cannot.
 */
export const getReadiness = (_req, res) => {
  const database = getDatabaseState();
  return sendSuccess(
    res,
    { status: database.isConnected ? 'ready' : 'degraded', database },
    { statusCode: database.isConnected ? 200 : 503 },
  );
};
