const jwt = require('jsonwebtoken');
const User = require('../models/User');

// ──────────────────────────────────────────────────────────────────────────────
// verifyToken
// Validates the Bearer JWT on any protected route.
// Attaches { id, role } to req.user on success.
// ──────────────────────────────────────────────────────────────────────────────
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    const token = authHeader.split(' ')[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Optionally verify user still exists in DB (catches deleted/suspended accounts)
    const user = await User.findById(decoded.id).select('_id role');
    if (!user) {
      return res.status(401).json({ message: 'User no longer exists.' });
    }

    req.user = { id: user._id, role: user.role };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Session expired. Please log in again.' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token.' });
    }
    res.status(500).json({ message: 'Token verification failed.', error: err.message });
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// isAdmin
// Composed middleware: verifies token THEN checks admin role.
// Use on any admin-only route: router.get('/admin/stats', isAdmin, handler)
// ──────────────────────────────────────────────────────────────────────────────
const isAdmin = [
  verifyToken,
  (req, res, next) => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        message: 'Forbidden. Admin access required.',
      });
    }
    next();
  },
];

// ──────────────────────────────────────────────────────────────────────────────
// isWorker
// ──────────────────────────────────────────────────────────────────────────────
const isWorker = [
  verifyToken,
  (req, res, next) => {
    if (req.user.role !== 'worker') {
      return res.status(403).json({ message: 'Forbidden. Worker access required.' });
    }
    next();
  },
];

// ──────────────────────────────────────────────────────────────────────────────
// isEmployer
// ──────────────────────────────────────────────────────────────────────────────
const isEmployer = [
  verifyToken,
  (req, res, next) => {
    if (req.user.role !== 'employer') {
      return res.status(403).json({ message: 'Forbidden. Employer access required.' });
    }
    next();
  },
];

module.exports = { verifyToken, isAdmin, isWorker, isEmployer };
