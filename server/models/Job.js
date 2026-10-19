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
      required: false,
      trim: true,
      default: '',
      maxlength: [1000, 'Description cannot exceed 1 000 characters.'],
    },

    requiredSkill: {
      type: String,
      required: false,
      enum: {
        values: [...SKILL_IDS, 'construction', 'carpentry', 'plumbing', 'electrical', 'cleaning', 'driving', 'painting', 'welding', 'masonry', 'gardening', 'security', 'cooking'],
        message: `requiredSkill must be one of: ${SKILL_IDS.join(', ')}.`,
      },
    },

    category: {
      type: String,
      trim: true,
      default: null,
    },

    skillsRequired: {
      type: [String],
      default: [],
    },

    dailyWage: {
      type: Number,
      required: false,
      min: [1, 'Daily wage must be at least ₹1.'],
    },

    wage: {
      type: Number,
      required: false,
      min: [1, 'Wage must be at least ₹1.'],
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

// Category and skills indices for efficient trade filtering
jobSchema.index({ category: 1 });
jobSchema.index({ skillsRequired: 1 });

// 2dsphere index for geospatial queries ($near, $geoWithin)
jobSchema.index({ location: '2dsphere' });

// ── Skill to Category and Default Skills Mappings ─────────────────────────────
const SKILL_TO_CATEGORY_MAP = {
  construction: 'Construction / Masonry',
  masonry:      'Construction / Masonry',
  carpentry:    'Construction / Masonry',
  welding:      'Construction / Masonry',
  plumbing:     'Plumbing',
  electrical:   'Electrical',
  cleaning:     'Housekeeping / Cleaning',
  cooking:      'Housekeeping / Cleaning',
  painting:     'Painting',
  gardening:    'Agriculture / Gardening',
  driving:      'Helper / Unskilled',
  security:     'Helper / Unskilled',
};

const DEFAULT_SKILLS_MAP = {
  construction: ['construction', 'masonry', 'building'],
  masonry:      ['masonry', 'brickwork', 'concrete'],
  carpentry:    ['carpentry', 'woodwork', 'furniture'],
  welding:      ['welding', 'fabrication', 'arc welding'],
  plumbing:     ['plumbing', 'pipe fitting', 'drainage'],
  electrical:   ['electrical', 'wiring', 'installation'],
  cleaning:     ['cleaning', 'housekeeping', 'sanitization'],
  cooking:      ['cooking', 'kitchen', 'meal preparation'],
  painting:     ['painting', 'whitewashing', 'polishing'],
  gardening:    ['gardening', 'agriculture', 'landscaping'],
  driving:      ['driving', 'helper', 'logistics'],
  security:     ['security', 'guard', 'watchman'],
};

jobSchema.pre('save', function (next) {
  if (!this.dailyWage && this.wage) {
    this.dailyWage = this.wage;
  }
  if (!this.wage && this.dailyWage) {
    this.wage = this.dailyWage;
  }
  if (!this.description) {
    this.description = this.title ? `${this.title} in ${this.city || 'local area'}` : 'Job listing';
  }
  if (!this.requiredSkill && this.skillsRequired && this.skillsRequired.length > 0) {
    this.requiredSkill = String(this.skillsRequired[0]).toLowerCase();
  }
  if (!this.category && this.requiredSkill) {
    this.category = SKILL_TO_CATEGORY_MAP[this.requiredSkill] || 'Helper / Unskilled';
  }
  if ((!this.skillsRequired || this.skillsRequired.length === 0) && this.requiredSkill) {
    this.skillsRequired = DEFAULT_SKILLS_MAP[this.requiredSkill] || [this.requiredSkill];
  }
  next();
});

const Job = mongoose.model('Job', jobSchema);
Job.SKILL_IDS = SKILL_IDS;
module.exports = Job;

