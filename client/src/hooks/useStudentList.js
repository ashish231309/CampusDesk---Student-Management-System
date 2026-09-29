import { useCallback, useEffect, useMemo, useState } from 'react';
import { studentService } from '../services/studentService.js';
import { describeLoadError } from '../utils/apiErrors.js';
import { PAGE_SIZE } from '../constants/student.js';

/**
 * Student list data source.
 *
 * The API does the searching, filtering, sorting and paging — this hook only
 * maps a filter object onto a request and keeps the results of the *current*
 * request on screen. Results are tagged with the request key they came from, so
 * a slow response for an old filter can never overwrite newer rows: an
 * unmatched key simply reads as "loading".
 *
 * `refresh` re-runs the current query, which is what keeps a delete or an edit
 * from leaving a stale row behind.
 */
export const useStudentList = (query = {}) => {
  const { search, status, year, department, course, sort, order, page = 1, limit = PAGE_SIZE } = query;

  const filter = useMemo(
    () => ({ search, status, year, department, course, sort, order, page, limit }),
    [course, department, limit, order, page, search, sort, status, year],
  );

  const requestKey = JSON.stringify(filter);
  const [result, setResult] = useState({ key: null, status: 'ready', students: [], meta: null, error: null });
  const [reloadToken, setReloadToken] = useState(0);

  const refresh = useCallback(() => setReloadToken((token) => token + 1), []);

  useEffect(() => {
    let active = true;

    studentService
      .list(filter)
      .then(({ students, meta }) => {
        if (active) {
          setResult({ key: requestKey, status: 'ready', students, meta, error: null });
        }
      })
      .catch((error) => {
        if (active) {
          setResult({ key: requestKey, status: 'error', students: [], meta: null, error });
        }
      });

    return () => {
      active = false;
    };
  }, [filter, requestKey, reloadToken]);

  const isCurrent = result.key === requestKey;

  return useMemo(() => {
    const loadError = isCurrent ? result.error : null;

    return {
      items: isCurrent ? result.students : [],
      meta: isCurrent ? result.meta : null,
      status: isCurrent ? result.status : 'loading',
      isLoading: !isCurrent && !loadError,
      error: loadError,
      // `kind` lets the page choose between "no results" and "could not load".
      errorKind: loadError ? describeLoadError(loadError).kind : null,
      isFiltered: Boolean(search || status || year || department || course),
      refresh,
    };
  }, [course, department, isCurrent, refresh, result, search, status, year]);
};
