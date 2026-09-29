import { useEffect, useMemo, useState } from 'react';
import { sampleStudents } from '../data/sampleStudents.js';

/**
 * Dashboard summary. Aggregates the design fixture locally for now; the equivalent
 * server-side aggregation already lives in `server/src/services/studentService.js`
 * and will back this hook once students are stored in MongoDB.
 */
export const useDashboardSummary = () => {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 280);
    return () => clearTimeout(timer);
  }, []);

  const summary = useMemo(() => {
    const active = sampleStudents.filter((student) => student.enrollmentStatus === 'active').length;
    const departments = new Set(sampleStudents.map((student) => student.department));

    const countBy = (key) =>
      Object.entries(
        sampleStudents.reduce((acc, student) => {
          acc[student[key]] = (acc[student[key]] ?? 0) + 1;
          return acc;
        }, {}),
      )
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count);

    const recent = [...sampleStudents]
      .sort((a, b) => new Date(b.dateOfRegistration) - new Date(a.dateOfRegistration))
      .slice(0, 5);

    return {
      total: sampleStudents.length,
      active,
      inactive: sampleStudents.length - active,
      departmentCount: departments.size,
      byDepartment: countBy('department'),
      byYear: countBy('year'),
      recent,
    };
  }, []);

  return { ...summary, isLoading };
};
