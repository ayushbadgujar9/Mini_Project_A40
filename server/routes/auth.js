const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();

// ──────────────────────────────────────────────────────────────────────────────
// Helper: Sign a JWT for a user
// ──────────────────────────────────────────────────────────────────────────────
const signToken = (user) =>
  jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/auth/register
// Body: { name, role, phoneNumber?, adminId?, password }
// Note: Admin self-registration is blocked; use `npm run seed` instead.
// ──────────────────────────────────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { name, role, phoneNumber, adminId, password } = req.body;

    // Block public admin registration
    if (role === 'admin') {
      return res.status(403).json({
        message: 'Admin accounts cannot be self-registered. Contact a system administrator.',
      });
    }

    if (!name || !role || !password) {
      return res.status(400).json({ message: 'name, role, and password are required.' });
    }

    // Build user payload dynamically
    const userData = { name, role, password };
    if (phoneNumber) userData.phoneNumber = phoneNumber;
    if (adminId) userData.adminId = adminId;

    const user = new User(userData);
    await user.save();

    const token = signToken(user);

    res.status(201).json({
      message: 'Registration successful.',
      token,
      user: { id: user._id, name: user.name, role: user.role },
    });
  } catch (err) {
    // Duplicate key (phone/adminId already exists)
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern)[0];
      return res.status(409).json({ message: `An account with this ${field} already exists.` });
    }
    // Mongoose validation errors
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map((e) => e.message);
      return res.status(400).json({ message: messages.join(' ') });
    }
    res.status(500).json({ message: 'Server error during registration.', error: err.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/auth/login
// Body (worker/employer): { phoneNumber, password }
// Body (admin):           { adminId,     password }
// ──────────────────────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { phoneNumber, adminId, password } = req.body;

    if (!password) {
      return res.status(400).json({ message: 'Password is required.' });
    }

    let user;

    if (phoneNumber) {
      // ── Worker / Employer login ──────────────────────────────────────────
      if (!phoneNumber.trim()) {
        return res.status(400).json({ message: 'Phone number cannot be empty.' });
      }
      user = await User.findOne({ phoneNumber }).select('+password');

      if (!user) {
        return res.status(401).json({ message: 'Invalid phone number or password.' });
      }
    } else if (adminId) {
      // ── Admin login ──────────────────────────────────────────────────────
      if (!adminId.trim()) {
        return res.status(400).json({ message: 'Admin ID cannot be empty.' });
      }
      user = await User.findOne({ adminId }).select('+password');

      if (!user) {
        return res.status(401).json({ message: 'Invalid admin ID or password.' });
      }
    } else {
      return res.status(400).json({
        message: 'Please provide either a phoneNumber or adminId to log in.',
      });
    }

    // ── Verify password ────────────────────────────────────────────────────
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      const errorMsg =
        phoneNumber ? 'Invalid phone number or password.' : 'Invalid admin ID or password.';
      return res.status(401).json({ message: errorMsg });
    }

    const token = signToken(user);

    res.status(200).json({
      message: 'Login successful.',
      token,
      user: { id: user._id, name: user.name, role: user.role },
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error during login.', error: err.message });
  }
});

module.exports = router;
