import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';

import { env } from './config/env.js';
import routes from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './middleware/notFound.js';

/**
 * Builds the Express application without starting a listener, which keeps the
 * app importable from tests and from the verify script.
 */
export const createApp = () => {
  const app = express();

  // Behind a proxy (Render, Railway, nginx…) so rate limiting sees real IPs.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(
    helmet({
      // The API only serves JSON; CSP is enforced by the client's own headers.
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  app.use(
    cors({
      origin: env.security.allowedOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    }),
  );

  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  if (!env.isTest) {
    app.use(
      morgan(env.isProduction ? 'combined' : 'dev', {
        skip: (req) => req.path === `${env.apiPrefix}/health`,
      }),
    );
  }

  // Broad safety net; per-endpoint limits (e.g. login attempts) come later.
  app.use(
    env.apiPrefix,
    rateLimit({
      windowMs: env.security.rateLimit.windowMs,
      max: env.security.rateLimit.max,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests. Please slow down and try again shortly.',
        },
      },
    }),
  );

  app.use(env.apiPrefix, routes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
};
