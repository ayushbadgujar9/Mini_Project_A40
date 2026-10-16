const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { verifyToken } = require('../middleware/auth');
const { sendOtpEmail, isSmtpConfigured } = require('../utils/mailer');

const router = express.Router();

// ──────────────────────────────────────────────────────────────────────────────
// Helper: Generate a cryptographically secure 6-digit OTP
// ──────────────────────────────────────────────────────────────────────────────
function generateOtp() {
  // crypto.randomInt gives a uniform random integer in [0, 900000) → add 100000
  return String(crypto.randomInt(100000, 1000000));
}

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/auth/send-email-otp
// Body: { email }
// Auth: Bearer token required
//
// Generates a 6-digit OTP, hashes it with bcrypt, saves it to the user's
// record with a 5-minute expiry, and sends the plain-text OTP via email.
// ──────────────────────────────────────────────────────────────────────────────
router.post('/send-email-otp', verifyToken, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !email.trim()) {
      return res.status(400).json({ message: 'Email address is required.' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Basic format check
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      return res.status(400).json({ message: 'Please provide a valid email address.' });
    }

    // Check if another user already owns this verified email
    const existingUser = await User.findOne({
      email: normalizedEmail,
      isEmailVerified: true,
      _id: { $ne: req.user.id },
    });

    if (existingUser) {
      return res.status(409).json({ message: 'This email is already verified by another account.' });
    }

    // Generate OTP
    const otpPlain = generateOtp();
    const salt = await bcrypt.genSalt(10);
    const otpHashed = await bcrypt.hash(otpPlain, salt);

    // Save hashed OTP + expiry (5 minutes from now)
    await User.findByIdAndUpdate(req.user.id, {
      email: normalizedEmail,
      emailOtp: otpHashed,
      emailOtpExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
      isEmailVerified: false,
    });

    // Send email (fire-and-forget with error handling)
    try {
      await sendOtpEmail(normalizedEmail, otpPlain);
    } catch (mailErr) {
      console.error('❌  Failed to send OTP email:', mailErr.message);
      return res.status(502).json({
        message: 'Failed to send verification email. Please check the email address and try again.',
      });
    }

    const isConfigured = isSmtpConfigured();

    res.status(200).json({
      message: isConfigured
        ? 'Verification code sent successfully.'
        : `Demo Mode: Code generated for ${normalizedEmail}. Check server console or on-screen code.`,
      email: normalizedEmail,
      expiresInSeconds: 300,
      devOtp: isConfigured ? undefined : otpPlain,
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: 'This email is already associated with another account.' });
    }
    console.error('send-email-otp error:', err);
    res.status(500).json({ message: 'Server error while sending OTP.', error: err.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/auth/confirm-email-otp
// Body: { otp }
// Auth: Bearer token required
//
// Verifies the user's inputted OTP against the stored hash.
// On success, sets isEmailVerified = true and clears OTP fields.
// ──────────────────────────────────────────────────────────────────────────────
router.post('/confirm-email-otp', verifyToken, async (req, res) => {
  try {
    const { otp } = req.body;

    if (!otp || !otp.trim()) {
      return res.status(400).json({ message: 'OTP is required.' });
    }

    const user = await User.findById(req.user.id).select('+emailOtp');

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    if (!user.emailOtp || !user.emailOtpExpiresAt) {
      return res.status(400).json({ message: 'No OTP request found. Please request a new code.' });
    }

    // Check expiry
    if (new Date() > user.emailOtpExpiresAt) {
      // Clear expired OTP
      user.emailOtp = null;
      user.emailOtpExpiresAt = null;
      await user.save();
      return res.status(410).json({ message: 'OTP has expired. Please request a new code.' });
    }

    // Compare OTP
    const isMatch = await bcrypt.compare(otp.trim(), user.emailOtp);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid OTP. Please check and try again.' });
    }

    // ✅ OTP is valid — mark email and profile as verified, clear OTP fields
    user.isEmailVerified = true;
    user.isVerified = true;
    user.verificationStatus = 'verified';
    user.emailOtp = null;
    user.emailOtpExpiresAt = null;
    await user.save();

    res.status(200).json({
      message: 'Email verified successfully! Your account is now verified.',
      isEmailVerified: true,
      isVerified: true,
      verificationStatus: user.verificationStatus,
    });
  } catch (err) {
    console.error('confirm-email-otp error:', err);
    res.status(500).json({ message: 'Server error while verifying OTP.', error: err.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/auth/email-status
// Auth: Bearer token required
//
// Returns the user's current email verification status.
// ──────────────────────────────────────────────────────────────────────────────
router.get('/email-status', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('email isEmailVerified');
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    res.status(200).json({
      email: user.email || null,
      isEmailVerified: user.isEmailVerified,
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

module.exports = router;
