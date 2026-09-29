import { useCallback, useEffect, useState } from 'react';
import { studentService } from '../services/studentService.js';
import { describeLoadError } from '../utils/apiErrors.js';

/**
 * A single student record for the detail and edit views.
 *
 * The resolved record is keyed by the requested id, so changing id reads as
 * "loading" without writing state synchronously inside the effect — and a
 * response for a previously-viewed student can never appear on screen.
 *
 * `status` is one of `loading`, `ready`, `missing` or `error`:
 *  - `missing` covers 404 *and* a malformed id (the API answers 422 for those),
 *    because both mean "there is nothing here to show";
 *  - anything else that fails — a 403, a database outage, a dropped connection —
 *    is `error`, so the page does not tell the user a record is gone when it
 *    simply could not be loaded.
 */
export const useStudent = (id) => {
  const key = id === null || id === undefined || id === '' ? null : String(id);
  const [resolved, setResolved] = useState({ key: null, status: 'loading', student: null, error: null });
  const [reloadToken, setReloadToken] = useState(0);

  const refresh = useCallback(() => setReloadToken((token) => token + 1), []);

  useEffect(() => {
    if (key === null) return undefined;

    let active = true;
    const controller = new AbortController();

    studentService
      .getById(key, { signal: controller.signal })
      .then((student) => {
        if (!active) return;
        setResolved(
          student
            ? { key, status: 'ready', student, error: null }
            : { key, status: 'missing', student: null, error: null },
        );
      })
      .catch((error) => {
        if (!active || error.isCancelled) return;
        const { kind } = describeLoadError(error);
        setResolved({
          key,
          status: kind === 'missing' ? 'missing' : 'error',
          student: null,
          error,
        });
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [key, reloadToken]);

  const isCurrent = key !== null && resolved.key === key;

  return {
    student: isCurrent ? resolved.student : null,
    status: isCurrent ? resolved.status : 'loading',
    error: isCurrent ? resolved.error : null,
    errorKind: isCurrent && resolved.error ? describeLoadError(resolved.error).kind : null,
    isLoading: !isCurrent,
    refresh,
  };
};
