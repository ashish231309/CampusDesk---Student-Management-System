import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

/**
 * Single source of truth for runtime configuration.
 * Everything the server reads from the environment passes through here so that
 * misconfiguration fails loudly at boot instead of somewhere deep in a request.
 */

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

dotenv.config({ path: path.join(serverRoot, '.env'), quiet: true });

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';
const isTest = nodeEnv === 'test';

/** Only used so the app is runnable on a fresh clone. Never valid in production. */
const DEVELOPMENT_JWT_SECRET = 'campusdesk-development-only-secret';

const readString = (key, fallback = '') => {
  const value = process.env[key];
  return value && value.trim() !== '' ? value.trim() : fallback;
};

const readNumber = (key, fallback) => {
  const value = Number(process.env[key]);
  return Number.isFinite(value) ? value : fallback;
};

const allowedOrigins = readString('CLIENT_ORIGIN', 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const jwtSecret = readString('JWT_SECRET', DEVELOPMENT_JWT_SECRET);

if (isProduction && jwtSecret === DEVELOPMENT_JWT_SECRET) {
  throw new Error('JWT_SECRET must be set to a strong, unique value in production.');
}

export const env = Object.freeze({
  nodeEnv,
  isProduction,
  isTest,
  isDevelopment: nodeEnv === 'development',
  port: readNumber('PORT', 5000),
  apiPrefix: readString('API_PREFIX', '/api'),
  serverRoot,

  database: {
    uri: readString('MONGODB_URI', 'mongodb://127.0.0.1:27017/campusdesk'),
    // Keep the boot sequence snappy when the database is not reachable yet.
    serverSelectionTimeoutMS: readNumber('MONGODB_SERVER_SELECTION_TIMEOUT_MS', 5000),
    // How long a query may wait for a connection before it is abandoned.
    bufferTimeoutMS: readNumber('MONGODB_BUFFER_TIMEOUT_MS', 2000),
  },

  jwt: {
    secret: jwtSecret,
    expiresIn: readString('JWT_EXPIRES_IN', '7d'),
  },

  security: {
    bcryptSaltRounds: readNumber('BCRYPT_SALT_ROUNDS', 10),
    allowedOrigins,
    rateLimit: {
      windowMs: readNumber('RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000),
      max: readNumber('RATE_LIMIT_MAX', 500),
    },
    // Stricter budget for the endpoints that accept credentials.
    authRateLimit: {
      windowMs: readNumber('AUTH_RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000),
      max: readNumber('AUTH_RATE_LIMIT_MAX', 30),
    },
  },

  logLevel: readString('LOG_LEVEL', isProduction ? 'info' : 'debug'),
});
