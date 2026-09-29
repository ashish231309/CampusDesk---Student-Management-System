import { Counter } from '../models/Counter.js';
import { STUDENT_ID_PREFIX } from '../constants/student.js';

/** Atomic counter upserts can collide under concurrency; a couple of retries
 * turn that into a successful increment. */
const MAX_COUNTER_ATTEMPTS = 3;
const DUPLICATE_KEY = 11000;

/** Pure formatter, so the identifier format can be verified without a database. */
export const formatStudentId = (year, sequence) =>
  `${STUDENT_ID_PREFIX}-${year}-${String(sequence).padStart(4, '0')}`;

/**
 * Student IDs are owned by the application, never typed in by a human.
 * Format: CDS-<registration year>-<zero-padded sequence>, e.g. CDS-2026-0042.
 *
 * The sequence lives in its own collection and is incremented with an atomic
 * `$inc`, so two concurrent inserts can never be handed the same number. The
 * upsert is retried once if Mongo reports a duplicate `_id`, which is the
 * documented outcome of two simultaneous upserts on the same counter.
 */
export const generateStudentId = async (registrationDate = new Date()) => {
  const year = new Date(registrationDate).getFullYear();
  const counterKey = `student:${year}`;

  for (let attempt = 1; attempt <= MAX_COUNTER_ATTEMPTS; attempt += 1) {
    try {
      const counter = await Counter.findByIdAndUpdate(
        counterKey,
        { $inc: { seq: 1 } },
        { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true },
      );

      return formatStudentId(year, counter.seq);
    } catch (error) {
      // The counter document was created by a concurrent request between our
      // upsert and the write — retrying simply increments the existing counter.
      if (error?.code === DUPLICATE_KEY && attempt < MAX_COUNTER_ATTEMPTS) continue;
      throw error;
    }
  }

  throw new Error(`Could not allocate a student ID for ${year}.`);
};
