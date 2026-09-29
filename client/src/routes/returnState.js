import { paths } from './paths.js';

/**
 * Where "back" goes after leaving the register.
 *
 * The register keeps its whole state in the URL — search, filters, sort, page and
 * page size — so walking into a student and coming back should land on the same
 * screen the user left, not on a reset one. The links that leave the register
 * record the URL they were on in router state; the screens they hand off to use
 * it for their back action, for Cancel, and for where a save or a delete lands.
 *
 * Two hops are tracked, because a student can be reached from two places:
 *
 *   registerFrom — the register URL a student workflow started from
 *   detailFrom   — the student's own URL, so editing can return to the record
 *
 * Only same-origin, internal paths are accepted. Anything else — an absent value,
 * a full URL, or a protocol-relative `//host` string that a browser would treat as
 * another site — falls back to the caller's own default, so this can never become
 * an open redirect.
 */
export const currentPath = (location) => `${location.pathname}${location.search}`;

const internalPath = (value) =>
  typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : null;

/** The register URL this workflow started from, or the register itself. */
export const backToRegister = (location, fallback = paths.students) =>
  internalPath(location.state?.registerFrom) ?? fallback;

/** The student this form was opened from, or the caller's fallback. */
export const backToStudent = (location, fallback) =>
  internalPath(location.state?.detailFrom) ?? fallback;
