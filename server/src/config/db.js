import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

const READY_STATES = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
};

mongoose.set('strictQuery', true);

/**
 * How long an operation may wait for a usable connection before it fails.
 *
 * Mongoose buffers queries by default and gives up after 10 seconds. Left alone,
 * a request that arrives while MongoDB is unreachable would occupy a connection
 * for that long — and disabling buffering entirely is worse: with no connection
 * the driver never settles the operation, so the request hangs indefinitely.
 * A short, explicit budget keeps every affected request bounded, and the error
 * handler turns the timeout into a clean 503.
 */
mongoose.set('bufferTimeoutMS', env.database.bufferTimeoutMS);

/**
 * Connect to MongoDB.
 *
 * A missing database is a hard failure in production, but during local
 * development CampusDesk still boots and serves the API so the frontend and the
 * health endpoint stay usable while the database is being provisioned.
 */
export const connectDatabase = async () => {
  try {
    await mongoose.connect(env.database.uri, {
      serverSelectionTimeoutMS: env.database.serverSelectionTimeoutMS,
    });
    logger.info('database', `Connected to MongoDB (${mongoose.connection.name}).`);
    return true;
  } catch (error) {
    const hint =
      'Start MongoDB or set MONGODB_URI in server/.env, then restart the API. ' +
      'Any endpoint that touches the database will fail until then.';

    if (env.isProduction) {
      logger.error('database', 'Could not connect to MongoDB.', error.message);
      throw error;
    }

    logger.warn('database', `Could not connect to MongoDB: ${error.message}`);
    logger.warn('database', hint);
    return false;
  }
};

export const disconnectDatabase = async () => {
  if (mongoose.connection.readyState === 0) return;
  await mongoose.disconnect();
  logger.info('database', 'MongoDB connection closed.');
};

export const getDatabaseState = () => {
  const state = READY_STATES[mongoose.connection.readyState] ?? 'unknown';
  return {
    state,
    isConnected: state === 'connected',
    name: mongoose.connection.name || null,
  };
};

/** Without this, a dropped connection mid-request surfaces as an unhandled rejection. */
mongoose.connection.on('error', (error) => {
  // A missing local database is an expected state during development.
  const log = env.isProduction ? logger.error : logger.warn;
  log('database', 'MongoDB connection error.', error.message);
});
