import { env } from '../config/env.js';

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const activeLevel = LEVELS[env.logLevel] ?? LEVELS.info;

const tint = (color, text) => `\u001b[${color}m${text}\u001b[0m`;

const write = (level, stream, color, scope, message, meta) => {
  if (LEVELS[level] > activeLevel) return;

  const timestamp = new Date().toISOString().slice(11, 19);
  const line = `${tint(90, timestamp)} ${tint(color, level.toUpperCase().padEnd(5))} ${tint(90, `[${scope}]`)} ${message}`;

  stream.write(`${line}\n`);

  if (meta !== undefined) {
    stream.write(`${typeof meta === 'string' ? meta : JSON.stringify(meta, null, 2)}\n`);
  }
};

/**
 * Minimal dependency-free logger. Keeps stdout readable during development and
 * stays compatible with log collectors in production.
 */
export const logger = {
  error: (scope, message, meta) => write('error', process.stderr, 31, scope, message, meta),
  warn: (scope, message, meta) => write('warn', process.stdout, 33, scope, message, meta),
  info: (scope, message, meta) => write('info', process.stdout, 36, scope, message, meta),
  debug: (scope, message, meta) => write('debug', process.stdout, 90, scope, message, meta),
};
