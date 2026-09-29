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

/**
 * Dashboard summary, straight from `GET /api/students/stats`.
 *
 * The aggregation is the API's job — counting and grouping in the browser would
 * only ever describe the page of records the client happens to hold. Rows are
 * reshaped into the `{ label, count }` the cards read, and the department count
 * comes from the distribution rather than a second request.
 *
 * The payload is tagged with the reload it belongs to, so a refresh shows the
 * loading state again without writing state synchronously inside the effect.
 */
export const useDashboardSummary = () => {
  const [reloadToken, setReloadToken] = useState(0);
  const [state, setState] = useState({ token: null, status: 'loading', stats: null, error: null });

  const refresh = useCallback(() => setReloadToken((token) => token + 1), []);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    studentService
      .stats({ signal: controller.signal })
      .then((stats) => {
        if (active) setState({ token: reloadToken, status: 'ready', stats, error: null });
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
  const stats = isCurrent ? state.stats : null;
  const loadError = isCurrent ? state.error : null;

  return {
    ...EMPTY,
    ...(stats
      ? {
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
        }
      : {}),
    status: isCurrent ? state.status : 'loading',
    error: loadError,
    errorKind: loadError ? describeLoadError(loadError).kind : null,
    isLoading: !isCurrent,
    isError: isCurrent && state.status === 'error',
    refresh,
  };
};
