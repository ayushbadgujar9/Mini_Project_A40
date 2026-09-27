const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// ──────────────────────────────────────────────────────────────────────────────
// Helper validators
// ──────────────────────────────────────────────────────────────────────────────
const requireForWorkerOrEmployer = {
  validator: function (value) {
    if (['worker', 'employer'].includes(this.role)) {
      return value != null && value.trim().length > 0;
    }
    return true; // Not required for admins
  },
  message: 'Phone number is required for workers and employers.',
};

const requireForAdmin = {
  validator: function (value) {
    if (this.role === 'admin') {
      return value != null && value.trim().length > 0;
    }
    return true; // Not required for workers / employers
  },
  message: 'Admin ID is required for admin accounts.',
};

// ──────────────────────────────────────────────────────────────────────────────
// Schema
// ──────────────────────────────────────────────────────────────────────────────
const userSchema = new mongoose.Schema(
  {
    // ── Identity ──────────────────────────────────────────────────────────────
    name: {
      type: String,
      required: [true, 'Name is required.'],
      trim: true,
    },

    role: {
      type: String,
      enum: {
        values: ['worker', 'employer', 'admin'],
        message: 'Role must be one of: worker, employer, admin.',
      },
      required: [true, 'Role is required.'],
    },

    // ── Worker / Employer credential ─────────────────────────────────────────
    phoneNumber: {
      type: String,
      trim: true,
      sparse: true, // Allows null/undefined but enforces uniqueness when set
      unique: true,
      validate: requireForWorkerOrEmployer,
      match: [/^\+?[1-9]\d{6,14}$/, 'Please provide a valid phone number.'],
    },

    // ── Admin credential ─────────────────────────────────────────────────────
    adminId: {
      type: String,
      trim: true,
      sparse: true,
      unique: true,
      validate: requireForAdmin,
    },

    // ── Shared credential ────────────────────────────────────────────────────
    password: {
      type: String,
      required: [true, 'Password is required.'],
      minlength: [6, 'Password must be at least 6 characters.'],
      select: false, // Never return password in queries by default
    },

    // ── Worker Profile ────────────────────────────────────────────────────────
    skills: {
      type: [String],
      default: [],
    },

    primarySkill: {
      type: String,
      default: null,
    },

    isVerified: {
      type: Boolean,
      default: false,
    },

    // ── Location (used for fairness proximity scoring) ────────────────────────
    city: {
      type: String,
      trim: true,
      default: null,
    },

    // ── Fairness Engine fields ────────────────────────────────────────────────
    lastWorkedDate: {
      type: Date,
      default: null,
    },

    totalJobsCompleted: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ── ID Image (retained for admin review) ──────────────────────────────────
    idImagePath: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// ──────────────────────────────────────────────────────────────────────────────
// Pre-save hook: Hash password before saving
// ──────────────────────────────────────────────────────────────────────────────
userSchema.pre('save', async function (next) {
  // Only hash when password field is new or modified
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// Instance method: Compare plain-text password to stored hash
// ──────────────────────────────────────────────────────────────────────────────
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// ──────────────────────────────────────────────────────────────────────────────
// Pre-save cross-field validation:
//   - Workers / employers must NOT have an adminId
//   - Admins must NOT have a phoneNumber
// ──────────────────────────────────────────────────────────────────────────────
userSchema.pre('save', function (next) {
  if (['worker', 'employer'].includes(this.role) && this.adminId) {
    return next(new Error('Workers and employers cannot have an adminId.'));
  }
  if (this.role === 'admin' && this.phoneNumber) {
    return next(new Error('Admins cannot have a phoneNumber.'));
  }
  next();
});

module.exports = mongoose.model('User', userSchema);
