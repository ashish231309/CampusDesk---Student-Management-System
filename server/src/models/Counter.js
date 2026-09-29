import mongoose from 'mongoose';

/**
 * Generic sequence holder. One document per logical counter
 * (for example `student:2026`), incremented atomically.
 */
const counterSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    seq: { type: Number, required: true, default: 0 },
  },
  { timestamps: true },
);

export const Counter = mongoose.model('Counter', counterSchema);
