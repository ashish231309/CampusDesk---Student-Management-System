import mongoose from 'mongoose';
import { generateStudentId } from '../utils/generateStudentId.js';
import {
  ENROLLMENT_STATUSES,
  STUDENT_EMAIL_PATTERN,
  STUDENT_ID_PATTERN,
  STUDENT_PHONE_PATTERN,
  STUDENT_YEARS,
} from '../constants/student.js';

/**
 * A student record. Every field the finished product needs is declared here so
 * later stages only have to add behaviour, not reshape the collection.
 */
const studentSchema = new mongoose.Schema(
  {
    studentId: {
      type: String,
      unique: true,
      immutable: true,
      trim: true,
      uppercase: true,
      // The value is generated, but the format is still guarded so an imported
      // or hand-edited document cannot drift away from CDS-YYYY-NNNN.
      match: [STUDENT_ID_PATTERN, 'Student IDs must look like CDS-2026-0001.'],
    },
    name: {
      type: String,
      required: [true, 'Student name is required.'],
      trim: true,
      minlength: [2, 'Student name must be at least 2 characters.'],
      maxlength: [120, 'Student name cannot exceed 120 characters.'],
    },
    email: {
      type: String,
      required: [true, 'Email is required.'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [STUDENT_EMAIL_PATTERN, 'Please provide a valid email address.'],
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required.'],
      trim: true,
      match: [STUDENT_PHONE_PATTERN, 'Please provide a valid phone number.'],
    },
    course: {
      type: String,
      required: [true, 'Course is required.'],
      trim: true,
      maxlength: [120, 'Course cannot exceed 120 characters.'],
    },
    year: {
      type: String,
      required: [true, 'Year of study is required.'],
      enum: { values: STUDENT_YEARS, message: '`{VALUE}` is not a valid year of study.' },
    },
    department: {
      type: String,
      required: [true, 'Department is required.'],
      trim: true,
      maxlength: [120, 'Department cannot exceed 120 characters.'],
    },
    dateOfRegistration: {
      type: Date,
      required: [true, 'Date of registration is required.'],
      default: Date.now,
    },
    enrollmentStatus: {
      type: String,
      enum: { values: ENROLLMENT_STATUSES, message: '`{VALUE}` is not a valid enrollment status.' },
      default: 'active',
    },
    /** Optional profile photo. Stores a URL / path, never binary data. */
    avatarUrl: { type: String, trim: true, default: '' },
  },
  { timestamps: true },
);

/**
 * Indexes.
 *
 * - `studentId` and `email` carry unique indexes from their field options.
 * - The register's default view is the newest records, optionally narrowed by
 *   enrollment status, so one compound index serves that query.
 * - Department and year are the two combinable filters; a compound index covers
 *   them whether they are used together or on their own (leftmost prefix).
 * - `{ year: 1 }` previously sat here on its own; the compound index replaces it.
 *
 * Free-text search is a case-insensitive regular expression over several fields.
 * MongoDB cannot use an index for a non-anchored regex, which is a deliberate
 * trade here: the collection is a campus register, and a search that matches
 * "ana" inside "Ananya" is what administrators actually expect. A text index
 * would only match whole words, so none is declared.
 */
studentSchema.index({ enrollmentStatus: 1, dateOfRegistration: -1 });
studentSchema.index({ department: 1, year: 1 });

/** The application assigns the ID, never the user. */
studentSchema.pre('validate', async function assignStudentId() {
  if (this.studentId) return;
  this.studentId = await generateStudentId(this.dateOfRegistration);
});

studentSchema.virtual('isActive').get(function isActive() {
  return this.enrollmentStatus === 'active';
});

studentSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

export const Student = mongoose.model('Student', studentSchema);
