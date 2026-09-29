import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { env } from '../config/env.js';

export const USER_ROLES = Object.freeze(['admin', 'staff']);

/**
 * Administrator / staff account used to sign in to CampusDesk.
 * Only a bcrypt hash is ever persisted — plaintext passwords are never stored
 * or logged. Authentication endpoints are wired up in a later build stage, but
 * the model is final so nothing has to be migrated later.
 */
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required.'],
      trim: true,
      maxlength: [80, 'Name cannot exceed 80 characters.'],
    },
    email: {
      type: String,
      required: [true, 'Email is required.'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, 'Please provide a valid email address.'],
    },
    passwordHash: {
      type: String,
      required: [true, 'Password is required.'],
      // Never load the hash unless a caller explicitly asks for it.
      select: false,
    },
    role: {
      type: String,
      enum: { values: USER_ROLES, message: '`{VALUE}` is not a supported role.' },
      default: 'admin',
    },
    lastLoginAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        delete ret.passwordHash;
        delete ret.__v;
        return ret;
      },
    },
  },
);

/**
 * Hashing stays on an async hook so the event loop is not blocked while a
 * password is being derived. Assign the plaintext through the `password`
 * virtual; it is never written to the database or kept on the document.
 */
userSchema.virtual('password').set(function setPassword(plaintext) {
  this._pendingPassword = plaintext;
});

userSchema.pre('validate', async function hashPassword() {
  if (!this._pendingPassword) return;
  this.passwordHash = await bcrypt.hash(this._pendingPassword, env.security.bcryptSaltRounds);
  this._pendingPassword = undefined;
});

userSchema.methods.verifyPassword = async function verifyPassword(plaintext) {
  if (!this.passwordHash || typeof plaintext !== 'string') return false;
  return bcrypt.compare(plaintext, this.passwordHash);
};

export const User = mongoose.model('User', userSchema);
