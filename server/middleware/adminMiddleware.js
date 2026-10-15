const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * adminMiddleware
 * Node.js middleware to restrict administrative endpoints to users with role === 'admin'.
 * Validates the JWT Bearer token and verifies user's role is 'admin'.
 */
const adminMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).select('_id role name');
    if (!user) {
      return res.status(401).json({ message: 'User no longer exists.' });
    }

    if (user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden. Administrative access required.' });
    }

    req.user = { id: user._id, role: user.role, name: user.name };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Session expired. Please log in again.' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid authentication token.' });
    }
    res.status(500).json({ message: 'Authorization check failed.', error: err.message });
  }
};

module.exports = adminMiddleware;
module.exports.adminMiddleware = adminMiddleware;
