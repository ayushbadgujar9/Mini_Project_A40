const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const { sendOtpEmail, isSmtpConfigured } = require('../utils/mailer');

const router = express.Router();

// ──────────────────────────────────────────────────────────────────────────────
// Pending Registration Store
// Holds temporary registration data for users who have not yet verified their
// email. Records auto-expire after 10 minutes and are never saved to the DB
// until OTP confirmation succeeds.
// ──────────────────────────────────────────────────────────────────────────────
const pendingRegistrations = new Map(); // key: normalizedEmail

const PENDING_TTL_MS = 10 * 60 * 1000; // 10 minutes

/** Remove any expired pending entries (called on each new registration). */
function cleanupExpiredPending() {
  const now = Date.now();
  for (const [email, entry] of pendingRegistrations.entries()) {
    if (now > entry.expiresAt) {
      pendingRegistrations.delete(email);
    }
  }
}

/**
 * generateAndSendOtpDirect(email, plainOtp)
 * Generates an OTP, hashes it, and returns { hashedOtp, expiresAt, plainOtp }.
 * Used for pending registrations where no DB record exists yet.
 */
async function generateOtpBundle() {
  const plainOtp = String(crypto.randomInt(100000, 1000000));
  const salt = await bcrypt.genSalt(10);
  const hashedOtp = await bcrypt.hash(plainOtp, salt);
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 min
  return { plainOtp, hashedOtp, expiresAt };
}

const ADMIN_EMAILS = [
  'akulkarni.1011@gmail.com',
  'ayushbadgujar9@gmail.com',
  'admin@fairconnect.com',
  'aakulkarni.1011@gmail.com',
];

const isAdminEmail = (email) => ADMIN_EMAILS.includes((email || '').trim().toLowerCase());

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
// Accepts: { name, email, role, password, phoneNumber }
//
// Does NOT create a DB record immediately. Instead the registration data is
// stored in an in-memory pending store and an OTP is sent. The User document
// is only created in MongoDB after the email is successfully verified.
// ──────────────────────────────────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { name, email, role, password, phoneNumber } = req.body;

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

    // Role validation: if email is a designated admin email, automatically grant admin
    let assignedRole = ['worker', 'employer'].includes(role) ? role : 'worker';
    if (isAdminEmail(normalizedEmail)) {
      assignedRole = 'admin';
    }

    // Check if a fully-saved user already exists in the DB
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      if (isAdminEmail(normalizedEmail) && existingUser.role !== 'admin') {
        existingUser.role = 'admin';
        existingUser.isVerified = true;
        existingUser.verificationStatus = 'verified';
        if (!existingUser.adminId) {
          existingUser.adminId = normalizedEmail.startsWith('ayush') ? 'ADMIN003' : 'ADMIN001';
        }
        await existingUser.save();
      }
      return res.status(409).json({
        message: 'An account with this email address already exists. Please sign in.',
        exists: true,
      });
    }

    cleanupExpiredPending();

    // Generate OTP bundle (no DB write yet)
    const { plainOtp, hashedOtp, expiresAt } = await generateOtpBundle();

    // Store pending registration (overwrites any previous attempt for same email)
    pendingRegistrations.set(normalizedEmail, {
      name: name.trim(),
      email: normalizedEmail,
      role: assignedRole,
      password: password && password.trim() ? password.trim() : undefined,
      phoneNumber: phoneNumber && phoneNumber.trim() ? phoneNumber.trim() : undefined,
      hashedOtp,
      expiresAt: expiresAt.getTime(),
    });

    console.log(`🔑 [OTP Code Generated for ${normalizedEmail}]: ${plainOtp}`);

    // Send OTP email
    let devOtp;
    const configured = isSmtpConfigured();
    try {
      await sendOtpEmail(normalizedEmail, plainOtp);
      devOtp = configured ? undefined : plainOtp;
    } catch (mailErr) {
      console.warn('⚠️  OTP email failed:', mailErr.message);
      devOtp = plainOtp; // Always expose in fallback
    }

    return res.status(201).json({
      message: 'Registration initiated. Verification code sent to your email.',
      email: normalizedEmail,
      expiresInSeconds: 300,
      devOtp,
      isNewUser: true,
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ message: 'Server error during registration.', error: err.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/auth/login
// Accepts either:
//   A) { phoneNumber, password } OR { adminId, password } OR { email, password }
//   B) { email } (passwordless email OTP)
// ──────────────────────────────────────────────────────────────────────────────
router.post(['/login', '/send-login-otp', '/send-otp'], async (req, res) => {
  try {
    const { email, phoneNumber, adminId, password } = req.body;

    // ── Mode A: Password-based Login ─────────────────────────────────────────
    if (password) {
      let user;

      if (phoneNumber && phoneNumber.trim()) {
        user = await User.findOne({ phoneNumber: phoneNumber.trim() }).select('+password');
        if (!user) {
          return res.status(401).json({ message: 'Invalid phone number or password.' });
        }
      } else if (adminId && adminId.trim()) {
        user = await User.findOne({ adminId: adminId.trim() }).select('+password');
        if (!user) {
          return res.status(401).json({ message: 'Invalid admin ID or password.' });
        }
      } else if (email && email.trim()) {
        const normalizedEmail = email.trim().toLowerCase();
        user = await User.findOne({ email: normalizedEmail }).select('+password');
        if (!user) {
          return res.status(401).json({ message: 'Invalid email or password.' });
        }
      } else {
        return res.status(400).json({ message: 'Please provide phone number, admin ID, or email with your password.' });
      }

      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(401).json({ message: 'Invalid credentials. Please check your password.' });
      }

      const token = signToken(user);
      return res.status(200).json({
        message: 'Login successful.',
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          phoneNumber: user.phoneNumber,
          adminId: user.adminId,
          isVerified: user.isVerified,
          isEmailVerified: user.isEmailVerified,
        },
      });
    }

    // ── Mode B: Passwordless Email OTP Login ──────────────────────────────────
    if (!email || !email.trim()) {
      return res.status(400).json({ message: 'Email address (or password credentials) is required.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      return res.status(400).json({ message: 'Please provide a valid email address.' });
    }

    let user = await User.findOne({ email: normalizedEmail });
    if (!user && isAdminEmail(normalizedEmail)) {
      user = await User.create({
        name: normalizedEmail.startsWith('ayush') ? 'System Admin (Ayush)' : 'Platform Admin',
        email: normalizedEmail,
        role: 'admin',
        adminId: normalizedEmail.startsWith('ayush') ? 'ADMIN003' : 'ADMIN001',
        isVerified: true,
        isEmailVerified: true,
        verificationStatus: 'verified',
      });
    }

    if (!user) {
      return res.status(404).json({
        message: 'No account found with this email. Please register below.',
        exists: false,
      });
    }

    if (isAdminEmail(normalizedEmail) && (user.role !== 'admin' || !user.isVerified)) {
      user.role = 'admin';
      user.isVerified = true;
      user.isEmailVerified = true;
      user.verificationStatus = 'verified';
      if (!user.adminId) {
        user.adminId = normalizedEmail.startsWith('ayush') ? 'ADMIN003' : 'ADMIN001';
      }
      await user.save();
    }

    // Generate OTP and store on user record
    const { plainOtp, hashedOtp, expiresAt } = await generateOtpBundle();
    user.currentOtp        = hashedOtp;
    user.otpExpiresAt      = expiresAt;
    user.emailOtp          = hashedOtp;
    user.emailOtpExpiresAt = expiresAt;
    await user.save();

    console.log(`🔑 [OTP Code Generated for ${normalizedEmail}]: ${plainOtp}`);

    let devOtp;
    const configured = isSmtpConfigured();
    try {
      await sendOtpEmail(normalizedEmail, plainOtp);
      devOtp = configured ? undefined : plainOtp;
    } catch (mailErr) {
      console.warn('⚠️  OTP email failed:', mailErr.message);
      devOtp = plainOtp;
    }

    res.status(200).json({
      message: `Verification code sent to ${normalizedEmail}. Valid for 5 minutes.`,
      email: normalizedEmail,
      expiresInSeconds: 300,
      devOtp,
      exists: true,
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error during login.', error: err.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/auth/demo-login
// Fast 1-click login for demonstration & development
// Accepts: { role: 'admin' | 'employer' | 'worker' }
// ──────────────────────────────────────────────────────────────────────────────
router.post('/demo-login', async (req, res) => {
  try {
    const { role } = req.body;
    const targetRole = ['admin', 'employer', 'worker'].includes(role) ? role : 'worker';

    const user = await User.findOne({ role: targetRole });
    if (!user) {
      return res.status(404).json({ message: `No demo account found for role "${targetRole}".` });
    }

    const token = signToken(user);
    res.status(200).json({
      message: `Signed in as demo ${targetRole}.`,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phoneNumber: user.phoneNumber,
        adminId: user.adminId,
        isVerified: user.isVerified,
        isEmailVerified: user.isEmailVerified,
      },
    });
  } catch (err) {
    console.error('Demo login error:', err);
    res.status(500).json({ message: 'Demo login failed.', error: err.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/auth/verify-otp
// Accepts: { email, otp }
//
// Two paths:
//   A) Pending registration — creates the User document in DB only now,
//      after email is confirmed. Deletes the pending entry on success.
//   B) Existing user (login OTP) — validates OTP stored in user's DB record.
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

    // ── Path A: Pending registration (not yet in DB) ──────────────────────────
    const pending = pendingRegistrations.get(normalizedEmail);
    if (pending) {
      // Check expiry
      if (Date.now() > pending.expiresAt) {
        pendingRegistrations.delete(normalizedEmail);
        return res.status(410).json({ message: 'Verification code has expired. Please register again.' });
      }

      // Compare OTP
      const isMatch = await bcrypt.compare(otp.trim(), pending.hashedOtp);
      if (!isMatch) {
        return res.status(401).json({ message: 'Invalid verification code. Please check and try again.' });
      }

      // ✅ OTP correct — now create the user in the DB
      const adminRole = isAdminEmail(normalizedEmail) ? 'admin' : pending.role;
      const newUser = new User({
        name:               pending.name,
        email:              normalizedEmail,
        role:               adminRole,
        password:           pending.password,
        phoneNumber:        pending.phoneNumber,
        adminId:            adminRole === 'admin'
                              ? (normalizedEmail.startsWith('ayush') ? 'ADMIN003' : 'ADMIN001')
                              : undefined,
        isEmailVerified:    true,
        isVerified:         adminRole !== 'worker',  // employers & admins auto-verified
        verificationStatus: adminRole === 'worker' ? 'unverified' : 'verified',
      });
      await newUser.save();

      pendingRegistrations.delete(normalizedEmail);

      const token = signToken(newUser);
      return res.status(200).json({
        message: 'Verification successful. Welcome to FairConnect!',
        token,
        user: {
          id:              newUser._id,
          name:            newUser.name,
          email:           newUser.email,
          role:            newUser.role,
          isVerified:      newUser.isVerified,
          isEmailVerified: newUser.isEmailVerified,
        },
      });
    }

    // ── Path B: Existing user login OTP ──────────────────────────────────────
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

    // Mark email as verified and clear OTP fields
    user.isEmailVerified = true;
    if (isAdminEmail(normalizedEmail) || user.role === 'admin') {
      user.role = 'admin';
      user.isVerified = true;
      user.verificationStatus = 'verified';
      if (!user.adminId) {
        user.adminId = normalizedEmail.startsWith('ayush') ? 'ADMIN003' : 'ADMIN001';
      }
    } else if (user.role !== 'worker') {
      user.isVerified = true;
      user.verificationStatus = 'verified';
    }
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
        id:              user._id,
        name:            user.name,
        email:           user.email,
        role:            user.role,
        isVerified:      user.isVerified,
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
