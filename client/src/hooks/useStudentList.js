import { useCallback, useEffect, useMemo, useState } from 'react';
import { onStudentsChanged, studentService } from '../services/studentService.js';
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
 * from leaving a stale row behind, and it is also wired to the service's own
 * "the register changed" announcement so an edit made on another screen cannot
 * leave this list out of date.
 *
 * Superseded requests are aborted as well as ignored: a fast typist produces
 * several, and only the newest one should occupy the network.
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
  /**
   * The last query this hook managed to answer. Once there is one, a later load
   * is an *update* to a register the user has already seen rather than the first
   * look at it — which is the difference between a page that fills in and a page
   * that briefly looks empty every time a filter changes.
   */
  const [answeredKey, setAnsweredKey] = useState(null);

  const refresh = useCallback(() => setReloadToken((token) => token + 1), []);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    studentService
      .list(filter, { signal: controller.signal })
      .then(({ students, meta }) => {
        if (active) {
          setResult({ key: requestKey, status: 'ready', students, meta, error: null });
          setAnsweredKey(requestKey);
        }
      })
      .catch((error) => {
        // A cancelled request says nothing about the data — the next one is
        // already on its way.
        if (active && !error.isCancelled) {
          setResult({ key: requestKey, status: 'error', students: [], meta: null, error });
        }
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [filter, requestKey, reloadToken]);

  useEffect(() => onStudentsChanged(refresh), [refresh]);

  const isCurrent = result.key === requestKey;

  return useMemo(() => {
    const loadError = isCurrent ? result.error : null;

    return {
      items: isCurrent ? result.students : [],
      meta: isCurrent ? result.meta : null,
      status: isCurrent ? result.status : 'loading',
      isLoading: !isCurrent && !loadError,
      // A query change on a register that has already loaded at least once.
      isUpdating: !isCurrent && !loadError && answeredKey !== null,
      error: loadError,
      // `kind` lets the page choose between "no results" and "could not load".
      errorKind: loadError ? describeLoadError(loadError).kind : null,
      isFiltered: Boolean(search || status || year || department || course),
      refresh,
    };
  }, [answeredKey, course, department, isCurrent, refresh, result, search, status, year]);
};
