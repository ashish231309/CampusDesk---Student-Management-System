import { createApp } from './app.js';
import { connectDatabase, disconnectDatabase } from './config/db.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';

const start = async () => {
  const databaseReady = await connectDatabase();
  if (env.isProduction && !databaseReady) {
    logger.error('server', 'Refusing to start without a database connection in production.');
    process.exit(1);
  }

  const app = createApp();

  const server = app.listen(env.port, '0.0.0.0', () => {
    logger.info('server', `CampusDesk API listening on http://localhost:${env.port}${env.apiPrefix}`);
    logger.info('server', `Environment: ${env.nodeEnv} · CORS origins: ${env.security.allowedOrigins.join(', ')}`);
  });

  const shutdown = async (signal) => {
    logger.info('server', `${signal} received — shutting down.`);
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
    // Do not hang forever on a stuck connection.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  ['SIGINT', 'SIGTERM'].forEach((signal) => process.on(signal, () => shutdown(signal)));

  process.on('unhandledRejection', (reason) => {
    logger.error('server', 'Unhandled promise rejection.', reason?.stack ?? String(reason));
  });

  process.on('uncaughtException', (error) => {
    logger.error('server', 'Uncaught exception — exiting.', error.stack ?? error.message);
    process.exit(1);
  });
};

start().catch((error) => {
  logger.error('server', 'Failed to start the API.', error.stack ?? error.message);
  process.exit(1);
});
