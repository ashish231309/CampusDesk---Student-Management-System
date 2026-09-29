import { useEffect, useMemo, useState } from 'react';
import { studentService } from '../services/studentService.js';
import { COURSE_SUGGESTIONS, DEPARTMENTS, ENROLLMENT_STATUSES, STUDENT_YEARS } from '../constants/student.js';

/**
 * Options for the register's filter controls.
 *
 * Course and department names are free-form in CampusDesk, so the options are
 * read back from the API's `/students/filters` endpoint — a department used by
 * one student, or a course typed in yesterday, is filterable today without
 * anyone maintaining a list. The curated suggestions both projects already
 * carry are merged in so an empty register still offers sensible choices.
 *
 * The request is a convenience, not a dependency: if it fails (offline, a
 * blip), the controls fall back to the curated lists and the register keeps
 * working.
 */
export const useStudentFilters = () => {
  const [discovered, setDiscovered] = useState(null);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    studentService
      .filters({ signal: controller.signal })
      .then((options) => {
        if (active) setDiscovered(options);
      })
      .catch(() => {
        // Falling back is the whole error strategy here — say nothing, offer
        // the known options, and let the list request report real problems.
        if (active) setDiscovered(null);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  return useMemo(() => {
    const merge = (discoveredValues = [], knownValues = []) => {
      const seen = new Set();
      const values = [];

      // Discovered values first: those are the ones actually in the register.
      for (const value of [...discoveredValues, ...knownValues]) {
        const key = value.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        values.push(value);
      }

      return values.sort((a, b) => a.localeCompare(b));
    };

    return {
      courses: merge(discovered?.courses, COURSE_SUGGESTIONS),
      departments: merge(discovered?.departments, DEPARTMENTS),
      years: discovered?.years?.length ? discovered.years : STUDENT_YEARS,
      statuses: discovered?.statuses?.length ? discovered.statuses : ENROLLMENT_STATUSES.map((s) => s.value),
      isDiscovered: Boolean(discovered),
    };
  }, [discovered]);
};
