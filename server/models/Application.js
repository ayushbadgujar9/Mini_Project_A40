const mongoose = require('mongoose');

// ──────────────────────────────────────────────────────────────────────────────
// Application Schema
// Tracks a worker's application to a specific job and the employer's decision.
// ──────────────────────────────────────────────────────────────────────────────
const applicationSchema = new mongoose.Schema(
  {
    job: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Job',
      required: [true, 'Job reference is required.'],
    },

    worker: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Worker reference is required.'],
    },

    employer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Employer reference is required.'],
    },

    status: {
      type: String,
      enum: {
        values: ['pending', 'accepted', 'rejected', 'completed'],
        message: 'Status must be one of: pending, accepted, rejected, completed.',
      },
      default: 'pending',
    },

    appliedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// ── Compound unique index: one application per worker per job ─────────────────
applicationSchema.index({ job: 1, worker: 1 }, { unique: true });

// ── Fast queries for worker's applications and employer's applicants ──────────
applicationSchema.index({ worker: 1, appliedAt: -1 });
applicationSchema.index({ employer: 1, job: 1 });

module.exports = mongoose.model('Application', applicationSchema);
