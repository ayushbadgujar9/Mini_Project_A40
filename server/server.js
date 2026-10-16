require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const authRoutes        = require('./routes/auth');
const emailOtpRoutes    = require('./routes/emailOtp');
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
app.use('/api/auth',         emailOtpRoutes);
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
const User = require('./models/User');

async function seedInitialUsersIfEmpty() {
  try {
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      console.log('🌱 Seeding initial demo users for development...');
      await User.create([
        {
          name: 'Platform Admin',
          phoneNumber: '+919000000000',
          adminId: 'ADMIN001',
          role: 'admin',
          verificationStatus: 'verified',
          isVerified: true,
          isEmailVerified: true,
          email: 'admin@fairconnect.org',
        },
        {
          name: 'Ramesh Patil',
          phoneNumber: '+919822012345',
          role: 'worker',
          verificationStatus: 'verified',
          isVerified: true,
          isEmailVerified: false,
          email: 'ramesh.patil@example.com',
        },
        {
          name: 'Sunil Deshmukh',
          phoneNumber: '+919833012345',
          role: 'employer',
          verificationStatus: 'verified',
          isVerified: true,
          isEmailVerified: true,
          email: 'sunil@deshmukh-farms.com',
        },
      ]);
      console.log('✅ Initial demo users seeded (Admin, Worker, Employer)');
    }
  } catch (seedErr) {
    console.warn('⚠️  Auto-seed notice:', seedErr.message);
  }
}

async function startServer() {
  let mongoUri = process.env.MONGO_URI;
  let connected = false;

  if (mongoUri) {
    try {
      await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 2000 });
      console.log('✅  MongoDB connected to', mongoUri);
      connected = true;
    } catch (err) {
      console.warn(`⚠️  Could not connect to external MongoDB at ${mongoUri} (${err.message})`);
    }
  }

  if (!connected) {
    console.log('📦 Starting in-memory MongoDB instance for local development...');
    try {
      const { MongoMemoryServer } = require('mongodb-memory-server');
      const mongod = await MongoMemoryServer.create();
      mongoUri = mongod.getUri();
      await mongoose.connect(mongoUri);
      console.log('✅  Embedded In-Memory MongoDB connected at', mongoUri);
      connected = true;
    } catch (memErr) {
      console.error('❌ Failed to start in-memory MongoDB:', memErr.message);
      process.exit(1);
    }
  }

  await seedInitialUsersIfEmpty();

  app.listen(PORT, () => {
    console.log(`🚀  FairConnect API running on http://localhost:${PORT}`);
  });
}

startServer();
