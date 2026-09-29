import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

/**
 * The only place tokens are signed or verified.
 *
 * The payload stays deliberately small: the account id, the role (useful for
 * logging and for the client's UI hints) and the standard `iat`/`exp` claims.
 * Nothing sensitive — no email, no name, no hash — travels inside the token,
 * because a token is readable by anyone who holds it.
 *
 * The role claim is *not* an authorization source: `requireAuth` loads the
 * account and reads the role from the database, so a tampered token cannot
 * elevate a staff account.
 */
export const signAuthToken = (user) =>
  jwt.sign({ sub: user.id, role: user.role }, env.jwt.secret, { expiresIn: env.jwt.expiresIn });

/** Throws `JsonWebTokenError` / `TokenExpiredError`, mapped to 401 upstream. */
export const verifyAuthToken = (token) => jwt.verify(token, env.jwt.secret);

/** Readable claims without verifying — used by diagnostics, never for access. */
export const decodeAuthToken = (token) => jwt.decode(token);
