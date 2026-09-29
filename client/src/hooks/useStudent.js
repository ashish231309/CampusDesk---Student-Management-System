import { useEffect, useState } from 'react';
import { sampleStudents } from '../data/sampleStudents.js';

/**
 * Single student lookup for the detail and edit views.
 *
 * The resolved record is keyed by the requested id, so a change of id reads as
 * "loading" without writing state synchronously inside the effect.
 * Falls back to the preview records until `studentService.getById` takes over.
 */
export const useStudent = (id) => {
  const key = id === null || id === undefined ? null : String(id);
  const [resolved, setResolved] = useState({ key: null, status: 'loading', student: null });

  useEffect(() => {
    if (key === null) return undefined;

    let active = true;

    // Stands in for the API round-trip the student endpoints will make.
    const timer = setTimeout(() => {
      if (!active) return;
      const student = sampleStudents.find((record) => record.id === key) ?? null;
      setResolved({ key, status: student ? 'ready' : 'not-found', student });
    }, 220);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [key]);

  const isCurrent = key !== null && resolved.key === key;

  return {
    student: isCurrent ? resolved.student : null,
    status: isCurrent ? resolved.status : 'loading',
    isLoading: !isCurrent,
  };
};
