require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const authRoutes        = require('./routes/auth');
const workerRoutes      = require('./routes/worker');
const adminRoutes       = require('./routes/admin');
const jobRoutes         = require('./routes/jobs');
const applicationRoutes = require('./routes/applicationRoutes');

const app = express();

// ── Middleware ─────────────────────────────────────────────────────────────────
app.use(cors({
  origin: 'http://localhost:5173', // Vite dev server
  credentials: true,
}));
app.use(express.json());

// ── Routes ─────────────────────────────────────────────────────────────────────
app.use('/api/auth',         authRoutes);
app.use('/api/worker',       workerRoutes);
app.use('/api/admin',        adminRoutes);
app.use('/api/jobs',         jobRoutes);
app.use('/api/applications', applicationRoutes);

// Serve uploaded ID images statically (for dev; use CDN/S3 in production)
app.use('/uploads', express.static(require('path').join(__dirname, 'uploads')));

// Health-check
app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'FairConnect API' }));

// 404 catch-all
app.use((_req, res) => res.status(404).json({ message: 'Route not found' }));

// Global error handler
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Internal server error', error: err.message });
});

// ── Database + Server Start ────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log('✅  MongoDB connected');
    app.listen(PORT, () => console.log(`🚀  FairConnect API running on http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error('❌  MongoDB connection error:', err.message);
    process.exit(1);
  });
