const mongoose = require('mongoose');

// ──────────────────────────────────────────────────────────────────────────────
// Schema: Passwordless User Model
// ──────────────────────────────────────────────────────────────────────────────
const userSchema = new mongoose.Schema(
  {
    // ── Identity ──────────────────────────────────────────────────────────────
    name: {
      type: String,
      required: [true, 'Name is required.'],
      trim: true,
    },

    email: {
      type: String,
      required: [true, 'Email is required.'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address.'],
    },

    role: {
      type: String,
      enum: {
        values: ['worker', 'employer', 'admin'],
        message: 'Role must be one of: worker, employer, admin.',
      },
      default: 'worker',
      required: [true, 'Role is required.'],
    },

    // ── Verification Status ──────────────────────────────────────────────────
    isVerified: {
      type: Boolean,
      default: false,
    },

    isEmailVerified: {
      type: Boolean,
      default: false,
    },

    verificationStatus: {
      type: String,
      enum: {
        values: ['unverified', 'pending', 'verified', 'rejected'],
        message: 'verificationStatus must be one of: unverified, pending, verified, rejected.',
      },
      default: 'unverified',
    },

    // ── Passwordless Email OTP Credentials ───────────────────────────────────
    currentOtp: {
      type: String,
      default: null,
      select: false, // Never return hashed OTP in general queries
    },

    otpExpiresAt: {
      type: Date,
      default: null,
    },

    // ── Compatibility Aliases for OTP fields ─────────────────────────────────
    emailOtp: {
      type: String,
      default: null,
      select: false,
    },

    emailOtpExpiresAt: {
      type: Date,
      default: null,
    },

    // ── Optional Profile Information ─────────────────────────────────────────
    phoneNumber: {
      type: String,
      trim: true,
      sparse: true,
      default: null,
    },

    adminId: {
      type: String,
      trim: true,
      sparse: true,
      default: null,
    },

    rejectionReason: {
      type: String,
      default: null,
    },

    ocrExtractedText: {
      type: String,
      default: null,
    },

    // ── Worker Profile Fields ────────────────────────────────────────────────
    skills: {
      type: [String],
      default: [],
    },

    primarySkill: {
      type: String,
      default: null,
    },

    city: {
      type: String,
      trim: true,
      default: null,
    },

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

    idImagePath: {
      type: String,
      default: null,
    },

    idCardUrl: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// ──────────────────────────────────────────────────────────────────────────────
// Pre-save cross-field validation:
// Workers / employers cannot have an adminId
// ──────────────────────────────────────────────────────────────────────────────
userSchema.pre('save', function (next) {
  if (['worker', 'employer'].includes(this.role) && this.adminId) {
    return next(new Error('Workers and employers cannot have an adminId.'));
  }
  next();
});

module.exports = mongoose.model('User', userSchema);
