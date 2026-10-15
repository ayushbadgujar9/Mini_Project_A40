const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const Tesseract = require('tesseract.js');

const { isWorker, verifyToken } = require('../middleware/auth');
const User = require('../models/User');

const router = express.Router();

// ── Ensure uploads directory exists ─────────────────────────────────────────
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// ── Multer config ────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/jpg'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG and PNG images are accepted.'));
    }
  },
});

// ── OCR keyword sets ─────────────────────────────────────────────────────────
// STRONG: long, unambiguous phrases — each counts as 2 hits
const STRONG_KEYWORDS = [
  'government of india',
  'date of birth',
  'driving licence',
  'driving license',
  'id card',
  'identification card',
  'election commission',
  'income tax',
];

// WEAK: short but specific tokens — matched only as whole words
// Each counts as 1 hit. Need total hits >= MIN_HITS to verify.
const WEAK_KEYWORDS = [
  'government',
  'republic',
  'identity',
  'identification',
  'aadhar',
  'aadhaar',
  'passport',
  'ration',
  'authority',
  'ministry',
  'department',
  'issued',
  'expiry',
  'nationality',
];

// Require at least this many keyword hits to pass
const MIN_HITS        = 2;
const MIN_TEXT_LENGTH = 50; // ignore images that produce almost no text

/**
 * scoreText — count weighted keyword hits in OCR output.
 * Strong phrases = 2 pts each, weak whole-word tokens = 1 pt each.
 */
function scoreText(lowerText) {
  let score = 0;

  for (const phrase of STRONG_KEYWORDS) {
    if (lowerText.includes(phrase)) score += 2;
  }

  for (const word of WEAK_KEYWORDS) {
    // Wrap in word boundary so 'voter' doesn't match 'devoter'
    const re = new RegExp(`\\b${word}\\b`);
    if (re.test(lowerText)) score += 1;
  }

  return score;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/worker/verify
// Upload an ID image → OCR → set isVerified if score >= MIN_HITS
// ─────────────────────────────────────────────────────────────────────────────
router.post('/verify', isWorker, upload.single('idImage'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No image file uploaded.' });
  }

  const filePath = req.file.path;

  try {
    // Persist the image path so the admin can view it during review
    await User.findByIdAndUpdate(req.user.id, { idImagePath: req.file.filename });
    // Run Tesseract OCR
    const { data: { text } } = await Tesseract.recognize(filePath, 'eng');
    const lowerText = text.toLowerCase().trim();

    // Guard: reject images that produce too little text (blank / unreadable)
    if (lowerText.length < MIN_TEXT_LENGTH) {
      await User.findByIdAndUpdate(req.user.id, {
        isVerified: false,
        verificationStatus: 'rejected',
        ocrExtractedText: text || 'Unreadable document',
        rejectionReason: 'The image is too blurry or unreadable.',
      });
      return res.status(200).json({
        verified: false,
        isVerified: false,
        message:
          'The image is too blurry or blank for our AI to read. Please upload a clear, well-lit photo of your government ID.',
      });
    }

    const score   = scoreText(lowerText);
    const matched = score >= MIN_HITS;
    const vStatus = matched ? 'verified' : 'pending';

    // Update user in DB
    const user = await User.findByIdAndUpdate(
      req.user.id,
      {
        isVerified: matched,
        verificationStatus: vStatus,
        ocrExtractedText: text,
      },
      { new: true }
    );

    return res.status(200).json({
      verified: matched,
      isVerified: user.isVerified,
      verificationStatus: user.verificationStatus,
      ocrExtractedText: text,
      message: matched
        ? 'ID verified successfully! Your profile is now marked as verified.'
        : 'ID submitted for manual admin review. We could not auto-verify government keywords.',
    });
  } catch (err) {
    return res.status(500).json({ message: 'OCR processing failed.', error: err.message });
  }
  // Note: file is retained on disk for admin ID review — no cleanup here
});

// ──────────────────────────────────────────────────────────────────────────────
// PUT /api/worker/profile
// Update skills, optional primarySkill, and optional city
// ──────────────────────────────────────────────────────────────────────────────
router.put('/profile', isWorker, async (req, res) => {
  try {
    const { skills, primarySkill, city } = req.body;

    if (!Array.isArray(skills) || skills.length === 0) {
      return res.status(400).json({ message: 'skills must be a non-empty array.' });
    }
    if (skills.length > 10) {
      return res.status(400).json({ message: 'You can select up to 10 skills.' });
    }
    if (!skills.every((s) => typeof s === 'string' && s.trim().length > 0)) {
      return res.status(400).json({ message: 'All skills must be non-empty strings.' });
    }

    const update = { skills: skills.map((s) => s.trim()) };
    if (primarySkill && typeof primarySkill === 'string') {
      update.primarySkill = primarySkill.trim();
    }
    if (city && typeof city === 'string') {
      update.city = city.trim();
    }

    const user = await User.findByIdAndUpdate(req.user.id, update, { new: true });

    return res.status(200).json({
      message: 'Profile updated successfully.',
      skills: user.skills,
      primarySkill: user.primarySkill,
      city: user.city,
      isVerified: user.isVerified,
    });
  } catch (err) {
    return res.status(500).json({ message: 'Profile update failed.', error: err.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/worker/profile
// Return current worker profile data including fairness fields
// ──────────────────────────────────────────────────────────────────────────────
router.get('/profile', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('name skills primarySkill isVerified role city lastWorkedDate totalJobsCompleted');
    if (!user) return res.status(404).json({ message: 'User not found.' });

    return res.status(200).json({
      name:               user.name,
      role:               user.role,
      skills:             user.skills,
      primarySkill:       user.primarySkill,
      isVerified:         user.isVerified,
      city:               user.city,
      lastWorkedDate:     user.lastWorkedDate,
      totalJobsCompleted: user.totalJobsCompleted,
    });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch profile.', error: err.message });
  }
});

module.exports = router;
