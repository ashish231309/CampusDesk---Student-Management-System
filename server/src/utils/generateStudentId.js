import { Counter } from '../models/Counter.js';
import { STUDENT_ID_PREFIX } from '../constants/student.js';

/**
 * Student IDs are owned by the application, never typed in by a human.
 * Format: CDS-<registration year>-<zero-padded sequence>, e.g. CDS-2026-0042.
 * The sequence is stored in its own collection so two concurrent inserts can
 * never be handed the same number.
 */
export const generateStudentId = async (registrationDate = new Date()) => {
  const year = new Date(registrationDate).getFullYear();
  const counterKey = `student:${year}`;

  const counter = await Counter.findByIdAndUpdate(
    counterKey,
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );

  return `${STUDENT_ID_PREFIX}-${year}-${String(counter.seq).padStart(4, '0')}`;
};
