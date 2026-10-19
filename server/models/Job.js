const mongoose = require('mongoose');

// ── Skill IDs must stay in sync with the frontend SKILLS catalogue ─────────────
const SKILL_IDS = [
  'plumbing',
  'electrician',
  'electrical', // alias
  'masonry',
  'masonary',   // alias
];

// ──────────────────────────────────────────────────────────────────────────────
// Schema
// ──────────────────────────────────────────────────────────────────────────────
const jobSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Job title is required.'],
      trim: true,
      maxlength: [100, 'Title cannot exceed 100 characters.'],
    },

    description: {
      type: String,
      required: [true, 'Job description is required.'],
      trim: true,
      maxlength: [1000, 'Description cannot exceed 1 000 characters.'],
    },

    requiredSkill: {
      type: String,
      required: [true, 'Required skill is required.'],
      enum: {
        values: SKILL_IDS,
        message: `requiredSkill must be one of: ${SKILL_IDS.join(', ')}.`,
      },
    },

    dailyWage: {
      type: Number,
      required: [true, 'Daily wage is required.'],
      min: [1, 'Daily wage must be at least ₹1.'],
    },

    employerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Employer reference is required.'],
    },

    // Worker assigned/hired for this job (set on completion)
    hiredWorkerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    // City where the job is located (for proximity fairness scoring)
    city: {
      type: String,
      trim: true,
      default: null,
    },

    // ── Location & GeoJSON (Point format for geospatial radius queries) ────────
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [longitude, latitude] e.g. [74.24, 16.70]
        default: [74.24, 16.70],
      },
    },

    status: {
      type: String,
      enum: {
        values: ['open', 'closed'],
        message: 'Status must be either open or closed.',
      },
      default: 'open',
    },

    isFlagged: {
      type: Boolean,
      default: false,
    },

    flagReason: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Index for quick queries on open jobs, newest first
jobSchema.index({ status: 1, createdAt: -1 });

// 2dsphere index for geospatial queries ($near, $geoWithin)
jobSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Job', jobSchema);
