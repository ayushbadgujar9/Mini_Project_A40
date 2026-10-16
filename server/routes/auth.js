const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { generateAndSendOTP } = require('../utils/otpService');

const router = express.Router();

// ──────────────────────────────────────────────────────────────────────────────
// Helper: Sign a JWT for a user
// ──────────────────────────────────────────────────────────────────────────────
const signToken = (user) =>
  jwt.sign(
    { id: user._id, role: user.role, email: user.email, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/auth/register
// Accepts: { name, email, role }
// Creates a new unverified user and calls generateAndSendOTP()
// ──────────────────────────────────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { name, email, role } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Name is required.' });
    }
    if (!email || !email.trim()) {
      return res.status(400).json({ message: 'Email address is required.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      return res.status(400).json({ message: 'Please provide a valid email address.' });
    }

    // Role validation (worker or employer)
    const assignedRole = ['worker', 'employer'].includes(role) ? role : 'worker';

    // Check if user already exists
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({
        message: 'An account with this email address already exists. Please sign in.',
        exists: true,
      });
    }

    // Create new unverified user without password
    const user = new User({
      name: name.trim(),
      email: normalizedEmail,
      role: assignedRole,
      isVerified: false,
      isEmailVerified: false,
      verificationStatus: 'unverified',
    });
    await user.save();

    // Call generateAndSendOTP
    const otpResult = await generateAndSendOTP(normalizedEmail);

    res.status(201).json({
      message: 'Registration initiated. Verification code sent to your email.',
      email: normalizedEmail,
      expiresInSeconds: otpResult.expiresInSeconds,
      devOtp: otpResult.devOtp,
      isNewUser: true,
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: 'An account with this email already exists.' });
    }
    console.error('Registration error:', err);
    res.status(500).json({ message: 'Server error during registration.', error: err.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/auth/login
// Accepts: { email }
// Checks if the user exists. If yes, calls generateAndSendOTP()
// ──────────────────────────────────────────────────────────────────────────────
router.post(['/login', '/send-login-otp', '/send-otp'], async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !email.trim()) {
      return res.status(400).json({ message: 'Email address is required.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      return res.status(400).json({ message: 'Please provide a valid email address.' });
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(404).json({
        message: 'No account found with this email. Please register below.',
        exists: false,
      });
    }

    // Call generateAndSendOTP
    const otpResult = await generateAndSendOTP(normalizedEmail);

    res.status(200).json({
      message: `Verification code sent to ${normalizedEmail}. Valid for 5 minutes.`,
      email: normalizedEmail,
      expiresInSeconds: otpResult.expiresInSeconds,
      devOtp: otpResult.devOtp,
      exists: true,
    });
  } catch (err) {
    console.error('Login OTP error:', err);
    res.status(500).json({ message: 'Server error sending login code.', error: err.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/auth/verify-otp
// Accepts: { email, otp }
// Compares the hash and checks expiration.
// If valid, updates isVerified: true (if false), clears OTP fields, returns JWT.
// ──────────────────────────────────────────────────────────────────────────────
router.post(['/verify-otp', '/verify-login-otp', '/confirm-email-otp'], async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !email.trim()) {
      return res.status(400).json({ message: 'Email address is required.' });
    }
    if (!otp || !otp.trim()) {
      return res.status(400).json({ message: '6-digit OTP code is required.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail }).select('+currentOtp +emailOtp');

    if (!user) {
      return res.status(404).json({ message: 'No account found with this email. Please register.' });
    }

    const storedOtp = user.currentOtp || user.emailOtp;
    const expiresAt = user.otpExpiresAt || user.emailOtpExpiresAt;

    if (!storedOtp || !expiresAt) {
      return res.status(400).json({ message: 'No pending OTP found. Please request a new code.' });
    }

    // Check expiration
    if (new Date() > expiresAt) {
      user.currentOtp = null;
      user.otpExpiresAt = null;
      user.emailOtp = null;
      user.emailOtpExpiresAt = null;
      await user.save();
      return res.status(410).json({ message: 'Verification code has expired. Please request a new code.' });
    }

    // Compare hash using bcrypt
    const isMatch = await bcrypt.compare(otp.trim(), storedOtp);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid verification code. Please check and try again.' });
    }

    // Mark user as verified and clear OTP fields
    user.isVerified = true;
    user.isEmailVerified = true;
    user.verificationStatus = 'verified';
    user.currentOtp = null;
    user.otpExpiresAt = null;
    user.emailOtp = null;
    user.emailOtpExpiresAt = null;
    await user.save();

    const token = signToken(user);

    res.status(200).json({
      message: 'Verification successful. Welcome to FairConnect!',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
        isEmailVerified: user.isEmailVerified,
      },
    });
  } catch (err) {
    console.error('verify-otp error:', err);
    res.status(500).json({ message: 'Server error during OTP verification.', error: err.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/auth/check-email
// Helper route to check if an email exists before prompting for details
// ──────────────────────────────────────────────────────────────────────────────
router.post('/check-email', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.trim()) {
      return res.status(400).json({ message: 'Email address is required.' });
    }
    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });
    res.status(200).json({
      exists: !!user,
      email: normalizedEmail,
      name: user ? user.name : null,
      role: user ? user.role : null,
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error checking email.', error: err.message });
  }
});

module.exports = router;
