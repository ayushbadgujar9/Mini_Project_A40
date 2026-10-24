const express = require('express');
const rateLimit = require('express-rate-limit');
const { verifyToken } = require('../middleware/auth');
const { assertChatAccess } = require('../middleware/chatGuard');
const Application = require('../models/Application');
const Message = require('../models/Message');
const User = require('../models/User');

const router = express.Router();

// ── Rate limiter: max 20 POSTs per minute per user ──────────────────────────
const postLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20,
  keyGenerator: (req) => req.user?.id?.toString() || req.ip,
  validate: { keyGeneratorIpFallback: false },
  handler: (_req, res) =>
    res.status(429).json({ message: 'Too many messages. Please slow down (max 20/min).' }),
  skip: (req) => req.method !== 'POST',
});

// All chat routes require authentication
router.use(verifyToken);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/chat/unread-counts
// Returns { [applicationId]: unreadCount } for the logged-in user.
// Only counts messages in 'accepted' or 'completed' applications the user
// participates in. Polled every 15 s by the client.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/unread-counts', async (req, res) => {
  try {
    const userId = req.user.id;

    // Find all applications the user participates in that are chat-eligible
    const applications = await Application.find({
      $or: [{ worker: userId }, { employer: userId }],
      status: { $in: ['accepted', 'completed'] },
    }).select('_id').lean();

    const appIds = applications.map((a) => a._id);

    // Count messages NOT read by this user, grouped by application
    const counts = await Message.aggregate([
      {
        $match: {
          application: { $in: appIds },
          sender: { $ne: userId },       // only the OTHER party's messages
          readBy: { $not: { $elemMatch: { $eq: userId } } }, // not yet read
        },
      },
      {
        $group: {
          _id: '$application',
          count: { $sum: 1 },
        },
      },
    ]);

    const result = {};
    counts.forEach(({ _id, count }) => {
      result[_id.toString()] = count;
    });

    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch unread counts.', error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/chat/:applicationId/contact
// Returns the other party's contact details (name, email, phoneNumber, city, role).
// Enforced by assertChatAccess so contacts are NEVER revealed before 'accepted'.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:applicationId/contact', async (req, res) => {
  try {
    const access = await assertChatAccess(req, res);
    if (!access) return;

    const other = await User.findById(access.otherPartyId)
      .select('name phoneNumber email city role')
      .lean();

    if (!other) {
      return res.status(404).json({ message: 'Other party not found.' });
    }

    return res.status(200).json({ contact: other });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch contact.', error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/chat/:applicationId/messages?after=<ISO date or message _id>
// Returns messages in ascending chronological order.
// Supports incremental polling via `after` (createdAt > after timestamp).
// Default limit 50, max 100.
// Also automatically marks messages sent by the other party as read by current user.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:applicationId/messages', async (req, res) => {
  try {
    const access = await assertChatAccess(req, res);
    if (!access) return;

    const { after } = req.query;
    const rawLimit = parseInt(req.query.limit, 10);
    const limit = isNaN(rawLimit) ? 50 : Math.min(rawLimit, 100);

    const filter = { application: access.application._id };

    if (after) {
      // Support both ISO timestamp and message _id for the `after` cursor
      const asDate = new Date(after);
      if (!isNaN(asDate.getTime())) {
        filter.createdAt = { $gt: asDate };
      }
    }

    const messages = await Message.find(filter)
      .sort({ createdAt: 1 })
      .limit(limit)
      .populate('sender', 'name role')
      .lean();

    // Mark other party's messages as read by current user
    const userId = req.user.id;
    await Message.updateMany(
      {
        application: access.application._id,
        sender: { $ne: userId },
        readBy: { $not: { $elemMatch: { $eq: userId } } },
      },
      { $addToSet: { readBy: userId } }
    );

    return res.status(200).json({ messages });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch messages.', error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/chat/:applicationId/messages
// Send a new message. Rate-limited to 20/min per user.
// Body: { text: string }
// Returns 403 if the application is 'completed' (read-only chat).
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:applicationId/messages', postLimiter, async (req, res) => {
  try {
    const access = await assertChatAccess(req, res);
    if (!access) return;

    // Completed jobs are read-only
    if (access.application.status === 'completed') {
      return res.status(403).json({
        message: 'Chat is closed for completed jobs.',
        readOnly: true,
      });
    }

    const rawText = typeof req.body.text === 'string' ? req.body.text.trim() : '';
    if (!rawText) {
      return res.status(400).json({ message: 'Message text cannot be empty.' });
    }
    if (rawText.length > 1000) {
      return res.status(400).json({
        message: 'Message is too long. Maximum 1000 characters.',
      });
    }

    // sender is always taken from the verified token — never from req.body
    const message = await Message.create({
      application: access.application._id,
      sender:      req.user.id,
      text:        rawText,
      readBy:      [req.user.id], // sender has implicitly read their own message
    });

    await message.populate('sender', 'name role');

    return res.status(201).json({ message });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to send message.', error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/chat/:applicationId/read
// Mark all messages from the other party as read for the calling user.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:applicationId/read', async (req, res) => {
  try {
    const access = await assertChatAccess(req, res);
    if (!access) return;

    const userId = req.user.id;

    await Message.updateMany(
      {
        application: access.application._id,
        sender: { $ne: userId },          // only messages from the other party
        readBy: { $not: { $elemMatch: { $eq: userId } } }, // not yet read
      },
      { $addToSet: { readBy: userId } }
    );

    return res.status(200).json({ message: 'Messages marked as read.' });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to mark messages as read.', error: err.message });
  }
});

module.exports = router;
