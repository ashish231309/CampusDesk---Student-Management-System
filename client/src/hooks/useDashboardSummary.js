import { useCallback, useEffect, useState } from 'react';
import { onStudentsChanged, studentService } from '../services/studentService.js';
import { describeLoadError } from '../utils/apiErrors.js';

const EMPTY = {
  total: 0,
  active: 0,
  inactive: 0,
  departmentCount: 0,
  byDepartment: [],
  byYear: [],
  recent: [],
};

/** Reshape the API's statistics payload into what the cards read. */
const readStats = (stats) => ({
  total: stats.total,
  active: stats.active,
  inactive: stats.inactive,
  departmentCount: stats.byDepartment?.length ?? 0,
  byDepartment: (stats.byDepartment ?? []).map((row) => ({
    label: row.department,
    count: row.count,
  })),
  byYear: (stats.byYear ?? []).map((row) => ({ label: row.year, count: row.count })),
  recent: stats.recentRegistrations ?? [],
});

/**
 * Dashboard summary, straight from `GET /api/students/stats`.
 *
 * The aggregation is the API's job — counting and grouping in the browser would
 * only ever describe the page of records the client happens to hold. Rows are
 * reshaped into the `{ label, count }` the cards read, and the department count
 * comes from the distribution rather than a second request.
 *
 * Two things are kept apart on purpose, because they read very differently:
 *
 *  - the *first* load has nothing to show, so it is `isLoading` and the panels
 *    draw skeletons;
 *  - a later load — after a student was created, edited or deleted — has real
 *    numbers already, so it keeps them on screen and reports `isRefreshing`
 *    instead. The figures are the last ones the API gave, never a guess, and the
 *    region is marked busy while the new ones are on their way.
 */
export const useDashboardSummary = () => {
  const [reloadToken, setReloadToken] = useState(0);
  const [state, setState] = useState({ token: null, status: 'loading', stats: null, error: null });
  const [lastGood, setLastGood] = useState(null);

  const refresh = useCallback(() => setReloadToken((token) => token + 1), []);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    studentService
      .stats({ signal: controller.signal })
      .then((stats) => {
        if (!active) return;
        setState({ token: reloadToken, status: 'ready', stats, error: null });
        setLastGood(stats);
      })
      .catch((error) => {
        if (active && !error.isCancelled) {
          setState({ token: reloadToken, status: 'error', stats: null, error });
        }
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [reloadToken]);

  // Creating, editing or deleting a student changes these numbers; the service
  // announces that so the cards cannot drift from the register.
  useEffect(() => onStudentsChanged(refresh), [refresh]);

  const isCurrent = state.token === reloadToken;
  const statistics = (isCurrent ? state.stats : null) ?? lastGood;
  const loadError = isCurrent ? state.error : null;

  return {
    ...EMPTY,
    ...(statistics ? readStats(statistics) : {}),
    status: isCurrent ? state.status : statistics ? 'ready' : 'loading',
    error: loadError,
    errorKind: loadError ? describeLoadError(loadError).kind : null,
    // Nothing on screen yet; the panels show their skeletons.
    isLoading: !statistics && !loadError,
    // Real numbers are on screen while newer ones are being read.
    isRefreshing: !isCurrent && Boolean(statistics),
    isError: isCurrent && state.status === 'error',
    hasData: Boolean(statistics),
    refresh,
  };
};
