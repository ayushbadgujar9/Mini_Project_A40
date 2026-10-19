require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const emailOtpRoutes = require('./routes/emailOtp');
const workerRoutes = require('./routes/worker');
const adminRoutes = require('./routes/admin');
const jobRoutes = require('./routes/jobs');
const applicationRoutes = require('./routes/applicationRoutes');

const app = express();

// ── Middleware ─────────────────────────────────────────────────────────────────
app.use(cors({
  origin: 'http://localhost:5173', // Vite dev server
  credentials: true,
}));
app.use(express.json());

// ── Routes ─────────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/auth', emailOtpRoutes);
app.use('/api/worker', workerRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/jobs', jobRoutes);
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
const Job = require('./models/Job');

async function seedInitialUsersIfEmpty() {
  try {
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      console.log('🌱 Seeding initial demo users and jobs for development...');

      // 1. Seed Admin
      const admin = await User.create({
        name: 'Platform Admin',
        phoneNumber: '+919000000000',
        adminId: 'ADMIN001',
        role: 'admin',
        verificationStatus: 'verified',
        isVerified: true,
        isEmailVerified: true,
        email: 'akulkarni.1011@gmail.com',
      });

      // 2. Seed Workers (verified & pending for ID review queue)
      const workers = await User.create([
        {
          name: 'Ramesh Patil',
          phoneNumber: '+919822012345',
          role: 'worker',
          verificationStatus: 'unverified',
          isVerified: false,
          isEmailVerified: true,
          email: 'ramesh.patil@example.com',
          skills: ['masonry'],
          primarySkill: 'masonry',
          city: 'Kolhapur',
          location: { type: 'Point', coordinates: [74.24, 16.70] },
          totalJobsCompleted: 14,
        },
        {
          name: 'Sunita Deshmukh',
          phoneNumber: '+919822054321',
          role: 'worker',
          verificationStatus: 'pending',
          isVerified: false,
          isEmailVerified: true,
          email: 'sunita.deshmukh@example.com',
          skills: ['plumbing'],
          primarySkill: 'plumbing',
          city: 'Kolhapur',
          location: { type: 'Point', coordinates: [74.25, 16.71] },
          idCardUrl: 'https://placehold.co/600x400/png?text=Sunita+Deshmukh+Aadhaar+Card',
          idImagePath: 'https://placehold.co/600x400/png?text=Sunita+Deshmukh+Aadhaar+Card',
          ocrExtractedText: 'GOVERNMENT OF INDIA - AADHAAR CARD\nName: Sunita Deshmukh\nDOB: 22/08/1993\nID Ref: MOCK_DOC_1002\nMatch Score: 88%',
          totalJobsCompleted: 4,
        },
        {
          name: 'Anand Shinde',
          phoneNumber: '+919822099887',
          role: 'worker',
          verificationStatus: 'pending',
          isVerified: false,
          isEmailVerified: true,
          email: 'anand.shinde@example.com',
          skills: ['plumbing', 'electrician'],
          primarySkill: 'plumbing',
          city: 'Kolhapur',
          location: { type: 'Point', coordinates: [74.23, 16.69] },
          idCardUrl: 'https://placehold.co/600x400/png?text=Anand+Shinde+Voter+ID',
          idImagePath: 'https://placehold.co/600x400/png?text=Anand+Shinde+Voter+ID',
          ocrExtractedText: 'ELECTION COMMISSION OF INDIA - VOTER ID\nName: Anand Shinde\nDOB: 10/11/1988\nID Ref: MOCK_DOC_1003\nMatch Score: 91%',
          totalJobsCompleted: 7,
        },
        {
          name: 'Ganesh Jadhav',
          phoneNumber: '+919822112233',
          role: 'worker',
          verificationStatus: 'verified',
          isVerified: true,
          isEmailVerified: true,
          email: 'ganesh.jadhav@example.com',
          skills: ['electrician', 'masonry'],
          primarySkill: 'electrician',
          city: 'Sangli',
          location: { type: 'Point', coordinates: [74.58, 16.85] },
          totalJobsCompleted: 9,
        },
      ]);

      // 3. Seed Employers
      const employer1 = await User.create({
        name: 'Sunil Deshmukh',
        phoneNumber: '+919833012345',
        role: 'employer',
        verificationStatus: 'verified',
        isVerified: true,
        isEmailVerified: true,
        email: 'sunil@deshmukh-farms.com',
        city: 'Kolhapur',
      });

      const employer2 = await User.create({
        name: 'Apex Constructions',
        phoneNumber: '+919811122233',
        role: 'employer',
        verificationStatus: 'verified',
        isVerified: true,
        isEmailVerified: true,
        email: 'contact@apexconstructions.com',
        city: 'Kolhapur',
      });

      // 4. Seed Jobs
      await Job.create([
        {
          title: 'Site Mason & Concrete Specialist',
          description: 'Need experienced masons for residential foundation and wall construction in central Kolhapur.',
          requiredSkill: 'masonry',
          dailyWage: 850,
          city: 'Kolhapur',
          location: { type: 'Point', coordinates: [74.243, 16.704] },
          status: 'open',
          isFlagged: false,
          employerId: employer2._id,
        },
        {
          title: 'Residential Electrical Rewiring & Inverter Setup',
          description: 'Licensed electrician needed for complete flat rewiring, MCB board installation, and inverter connection.',
          requiredSkill: 'electrician',
          dailyWage: 900,
          city: 'Kolhapur',
          location: { type: 'Point', coordinates: [74.249, 16.711] },
          status: 'open',
          isFlagged: false,
          employerId: employer1._id,
        },
        {
          title: 'Commercial Electrical & Panel Wiring',
          description: 'Electrician needed for retail shop fit-out and main circuit distribution near Tarabai Park.',
          requiredSkill: 'electrician',
          dailyWage: 950,
          city: 'Kolhapur',
          location: { type: 'Point', coordinates: [74.262, 16.720] },
          status: 'open',
          isFlagged: false,
          employerId: employer2._id,
        },
        {
          title: 'Brick Wall Construction & Exterior Plastering',
          description: 'Skilled mason required for boundary wall brick laying and waterproof cement plastering.',
          requiredSkill: 'masonry',
          dailyWage: 850,
          city: 'Kolhapur',
          location: { type: 'Point', coordinates: [74.285, 16.735] },
          status: 'open',
          isFlagged: false,
          employerId: employer1._id,
        },
        {
          title: 'Apartment Bathroom & Drainage Plumbing',
          description: 'Certified plumber needed for CPVC line layout, sanitary fittings, and main drain pipe connection.',
          requiredSkill: 'plumbing',
          dailyWage: 950,
          city: 'Kolhapur',
          location: { type: 'Point', coordinates: [74.310, 16.760] },
          status: 'open',
          isFlagged: false,
          employerId: employer2._id,
        },
        {
          title: 'Heritage Stone Masonry & Restoration',
          description: 'Artisan mason needed for traditional basalt stone wall refurbishment and mortar pointing.',
          requiredSkill: 'masonry',
          dailyWage: 900,
          city: 'Kolhapur',
          location: { type: 'Point', coordinates: [74.360, 16.780] },
          status: 'open',
          isFlagged: false,
          employerId: employer1._id,
        },
        {
          title: 'Warehouse Main Water Tank Pipeline Setup',
          description: 'Plumber required for 5000L overhead water tank plumbing, pump connection, and pressure valve fittings.',
          requiredSkill: 'plumbing',
          dailyWage: 850,
          city: 'Sangli',
          location: { type: 'Point', coordinates: [74.582, 16.853] },
          status: 'closed',
          isFlagged: false,
          employerId: employer1._id,
          hiredWorkerId: workers[0]._id,
        },
        {
          title: 'Urgent Commercial Plumbing Repairs',
          description: 'Pipeline leakage in commercial plaza basement. Immediate intervention required.',
          requiredSkill: 'plumbing',
          dailyWage: 950,
          city: 'Kolhapur',
          location: { type: 'Point', coordinates: [74.254, 16.701] },
          status: 'open',
          isFlagged: true,
          flagReason: 'Reported by users as unrealistic wage guarantee and suspicious contact requirement.',
          employerId: employer2._id,
        },
      ]);

      console.log('✅ Initial demo platform data seeded: Admin, 4 Workers (2 Pending ID Reviews), 2 Employers, 8 Jobs (Plumbing, Electrician, Masonry)');
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
    console.log('📦 Starting persistent local MongoDB instance for development...');
    try {
      const { MongoMemoryServer } = require('mongodb-memory-server');
      const dbPath = path.join(__dirname, '.mongodb_data');
      if (!fs.existsSync(dbPath)) fs.mkdirSync(dbPath, { recursive: true });

      let mongod;
      try {
        mongod = await MongoMemoryServer.create({
          instance: {
            port: 27017,
            dbName: 'fairconnect',
            dbPath,
            storageEngine: 'wiredTiger',
          },
        });
      } catch (_portErr) {
        mongod = await MongoMemoryServer.create({
          instance: {
            dbName: 'fairconnect',
            dbPath,
            storageEngine: 'wiredTiger',
          },
        });
      }
      mongoUri = mongod.getUri('fairconnect');
      await mongoose.connect(mongoUri);
      console.log('✅  Persistent Local MongoDB connected at', mongoUri);
      console.log(`🧭  To view in MongoDB Compass, connect to:\n    👉 ${mongoUri}\n`);
      connected = true;
    } catch (memErr) {
      console.error('❌ Failed to start persistent MongoDB:', memErr.message);
      process.exit(1);
    }
  }

  await seedInitialUsersIfEmpty();

  app.listen(PORT, () => {
    console.log(`🚀  FairConnect API running on http://localhost:${PORT}`);
  });
}

startServer();
