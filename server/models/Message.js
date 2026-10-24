const mongoose = require('mongoose');

// ──────────────────────────────────────────────────────────────────────────────
// Message Schema
// Each document is one chat message within an accepted/completed application.
// ──────────────────────────────────────────────────────────────────────────────
const messageSchema = new mongoose.Schema(
  {
    application: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Application',
      required: [true, 'Application reference is required.'],
      index: true,
    },

    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Sender reference is required.'],
    },

    text: {
      type: String,
      trim: true,
      required: [true, 'Message text is required.'],
      maxlength: [1000, 'Message cannot exceed 1000 characters.'],
    },

    // User IDs who have read this message
    readBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient chronological fetch per application
messageSchema.index({ application: 1, createdAt: 1 });

module.exports = mongoose.model('Message', messageSchema);
