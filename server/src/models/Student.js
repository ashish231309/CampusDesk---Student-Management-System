import mongoose from 'mongoose';
import { generateStudentId } from '../utils/generateStudentId.js';
import {
  ENROLLMENT_STATUSES,
  STUDENT_EMAIL_PATTERN,
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
    },
    name: {
      type: String,
      required: [true, 'Student name is required.'],
      trim: true,
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
      index: true,
    },
    /** Optional profile photo. Stores a URL / path, never binary data. */
    avatarUrl: { type: String, trim: true, default: '' },
  },
  { timestamps: true },
);

// Supports the student list search box without full collection scans.
studentSchema.index({ name: 'text', email: 'text', studentId: 'text', course: 'text' });
studentSchema.index({ department: 1, year: 1 });

/** The application assigns the ID, never the user. */
studentSchema.pre('validate', async function assignStudentId(next) {
  if (this.studentId) return next();
  try {
    this.studentId = await generateStudentId(this.dateOfRegistration);
    return next();
  } catch (error) {
    return next(error);
  }
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
