import { useCallback, useEffect, useMemo, useState } from 'react';
import { sampleStudents } from '../data/sampleStudents.js';
import { PAGE_SIZE } from '../constants/student.js';

/**
 * Student list data source.
 *
 * Still reading the design fixture in `data/sampleStudents.js` (see the note
 * there); it applies the
 * same search, filter, sort and pagination the API will apply server-side, so
 * the table, filters and empty states are exercised for real. Swapping the body
 * of `load` for `studentService.list(query)` is the only change needed once the
 * student endpoints are live.
 */
const load = (query) =>
  new Promise((resolve) => {
    const term = query.search?.trim().toLowerCase();

    let rows = sampleStudents.filter((student) => {
      const matchesTerm =
        !term ||
        [student.name, student.studentId, student.email, student.course, student.department]
          .join(' ')
          .toLowerCase()
          .includes(term);

      const matchesStatus = !query.status || student.enrollmentStatus === query.status;
      const matchesYear = !query.year || student.year === query.year;
      const matchesDepartment = !query.department || student.department === query.department;

      return matchesTerm && matchesStatus && matchesYear && matchesDepartment;
    });

    rows = [...rows].sort((a, b) => {
      const descending = query.sort?.startsWith('-');
      const field = descending ? query.sort.slice(1) : (query.sort ?? 'dateOfRegistration');
      const direction = descending ? -1 : 1;

      if (field === 'name' || field === 'studentId') {
        return a[field].localeCompare(b[field]) * direction;
      }
      return (new Date(a.dateOfRegistration) - new Date(b.dateOfRegistration)) * direction;
    });

    const total = rows.length;
    const limit = query.limit ?? PAGE_SIZE;
    const page = Math.max(query.page ?? 1, 1);
    const start = (page - 1) * limit;

    // A short delay keeps the loading skeletons part of the normal flow.
    setTimeout(
      () =>
        resolve({
          items: rows.slice(start, start + limit),
          meta: { page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1) },
        }),
      320,
    );
  });

export const useStudentList = (query = {}) => {
  const { search, status, year, department, sort, page = 1, limit = PAGE_SIZE } = query;

  const filter = useMemo(
    () => ({ search, status, year, department, sort, page, limit }),
    [search, status, year, department, sort, page, limit],
  );

  // The request key doubles as the loading signal: results that do not match the
  // key on screen are stale by definition.
  const requestKey = JSON.stringify(filter);
  const [result, setResult] = useState({ key: null, status: 'ready', items: [], meta: null, error: null });

  const run = useCallback(() => load(filter), [filter]);

  useEffect(() => {
    let active = true;

    run()
      .then((response) => {
        if (active) {
          setResult({ key: requestKey, status: 'ready', items: response.items, meta: response.meta, error: null });
        }
      })
      .catch((error) => {
        if (active) {
          setResult({ key: requestKey, status: 'error', items: [], meta: null, error });
        }
      });

    return () => {
      active = false;
    };
  }, [requestKey, run]);

  const isCurrent = result.key === requestKey;

  return useMemo(
    () => ({
      items: isCurrent ? result.items : [],
      meta: isCurrent ? result.meta : null,
      status: isCurrent ? result.status : 'loading',
      isLoading: !isCurrent,
      error: isCurrent ? result.error : null,
      isFiltered: Boolean(search || status || year || department),
    }),
    [department, isCurrent, result, search, status, year],
  );
};
