const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config({ path: path.join(__dirname, '../../.env') });

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('../models/User');
const Job = require('../models/Job');
let Application;
try {
  Application = require('../models/Application');
} catch (_) {
  Application = null;
}

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/fairconnect';

async function seedDatabase() {
  try {
    console.log('🌱 Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB:', MONGO_URI);

    // ── 1. Clear Existing Test Data ──────────────────────────────────────────
    console.log('🧹 Clearing existing database test records...');
    await User.deleteMany({});
    await Job.deleteMany({});
    if (Application) {
      await Application.deleteMany({});
    }
    console.log('✅ Existing collection data cleared.');

    // ── 2. Seed System Admin Account ─────────────────────────────────────────
    console.log('👤 Seeding System Admin Account...');

    const admin = new User({
      name: 'Platform Admin',
      phoneNumber: '+919000000000',
      adminId: 'ADMIN001',
      password: 'admin123', // Mongoose pre-save hook automatically hashes with bcrypt
      role: 'admin',
      verificationStatus: 'verified',
      isVerified: true,
    });
    await admin.save();

    console.log('  ✅ Admin Created:');
    console.log('     Name       : Platform Admin');
    console.log('     Phone      : +919000000000');
    console.log('     Admin ID   : ADMIN001');
    console.log('     Password   : admin123');
    console.log('     Role       : admin');

    // ── 3. Seed Pending Worker Verifications ─────────────────────────────────
    console.log('\n👷 Seeding Pending Worker Verifications (Kolhapur Region)...');

    const workerDataList = [
      {
        name: 'Ramesh Patil',
        phoneNumber: '+919822012345',
        password: 'worker123',
        role: 'worker',
        verificationStatus: 'pending',
        isVerified: false,
        skills: ['Masonry', 'Construction'],
        primarySkill: 'Masonry',
        city: 'Kolhapur',
        location: { type: 'Point', coordinates: [74.24, 16.70] },
        idCardUrl: 'https://placehold.co/600x400?text=Worker+ID+Card+1',
        idImagePath: 'https://placehold.co/600x400?text=Worker+ID+Card+1',
        ocrData: {
          extractedName: 'Ramesh Patil',
          mockDocRef: 'MOCK_DOC_1001',
          ocrMatchScore: '94%',
        },
        ocrExtractedText: 'GOVERNMENT OF INDIA - AADHAAR CARD\nName: Ramesh Patil\nDOB: 12/05/1990\nID Ref: MOCK_DOC_1001\nMatch Score: 94%',
      },
      {
        name: 'Sunita Deshmukh',
        phoneNumber: '+919822054321',
        password: 'worker123',
        role: 'worker',
        verificationStatus: 'pending',
        isVerified: false,
        skills: ['Housekeeping', 'Cooking'],
        primarySkill: 'Cooking',
        city: 'Kolhapur',
        location: { type: 'Point', coordinates: [74.25, 16.71] },
        idCardUrl: 'https://placehold.co/600x400?text=Worker+ID+Card+2',
        idImagePath: 'https://placehold.co/600x400?text=Worker+ID+Card+2',
        ocrData: {
          extractedName: 'Sunita Deshmukh',
          mockDocRef: 'MOCK_DOC_1002',
          ocrMatchScore: '88%',
        },
        ocrExtractedText: 'GOVERNMENT OF INDIA - AADHAAR CARD\nName: Sunita Deshmukh\nDOB: 22/08/1993\nID Ref: MOCK_DOC_1002\nMatch Score: 88%',
      },
      {
        name: 'Anand Shinde',
        phoneNumber: '+919822099887',
        password: 'worker123',
        role: 'worker',
        verificationStatus: 'pending',
        isVerified: false,
        skills: ['Plumbing', 'Electrical'],
        primarySkill: 'Plumbing',
        city: 'Kolhapur',
        location: { type: 'Point', coordinates: [74.23, 16.69] },
        idCardUrl: 'https://placehold.co/600x400?text=Worker+ID+Card+3',
        idImagePath: 'https://placehold.co/600x400?text=Worker+ID+Card+3',
        ocrData: {
          extractedName: 'Anand Shinde',
          mockDocRef: 'MOCK_DOC_1003',
          ocrMatchScore: '91%',
        },
        ocrExtractedText: 'ELECTION COMMISSION OF INDIA - VOTER ID\nName: Anand Shinde\nDOB: 10/11/1988\nID Ref: MOCK_DOC_1003\nMatch Score: 91%',
      },
    ];

    const seededWorkers = [];
    for (const wData of workerDataList) {
      const w = new User(wData);
      await w.save();
      seededWorkers.push(w);
      console.log(`  ✅ Worker Created: ${w.name} (${w.phoneNumber}) - Verification: ${w.verificationStatus}`);
    }

    // ── 4. Seed Employer & Job Listings ───────────────────────────────────────
    console.log('\n🏢 Seeding Employer & Job Listings for Admin Moderation Queue...');

    const employer = new User({
      name: 'Apex Constructions',
      phoneNumber: '+919811122233',
      password: 'employer123',
      role: 'employer',
      verificationStatus: 'verified',
      isVerified: true,
      city: 'Kolhapur',
      location: { type: 'Point', coordinates: [74.24, 16.70] },
    });
    await employer.save();

    console.log(`  ✅ Employer Created: ${employer.name} (${employer.phoneNumber})`);

    const jobsData = [
      {
        title: 'Site Mason & Concrete Specialist',
        description: 'Need experienced masons for residential project in Kolhapur city.',
        requiredSkill: 'masonry',
        dailyWage: 850,
        city: 'Kolhapur',
        status: 'open',
        isFlagged: false,
        employerId: employer._id,
      },
      {
        title: 'Urgent Commercial Plumbing Repairs',
        description: 'Plumbing repairs for commercial building in central Kolhapur.',
        requiredSkill: 'plumbing',
        dailyWage: 950,
        city: 'Kolhapur',
        status: 'open',
        isFlagged: true,
        flagReason: 'Reported as potential spam wage listing',
        employerId: employer._id,
      },
    ];

    for (const jData of jobsData) {
      const job = await Job.create(jData);
      console.log(`  ✅ Job Posting Created: "${job.title}" - Wage: ₹${job.dailyWage}/day (Flagged: ${job.isFlagged})`);
    }

    console.log('\n🎉 Database Seed Completed Successfully!');
    console.log('───────────────────────────────────────────────────');
    console.log('📊 Summary:');
    console.log('   - Admin Users  : 1');
    console.log('   - Workers      : 3 (Pending Verification)');
    console.log('   - Employers    : 1');
    console.log('   - Job Listings : 2 (1 Flagged for Moderation)');
    console.log('───────────────────────────────────────────────────\n');
  } catch (err) {
    console.error('❌ Database Seeding Error:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Mongoose disconnected.');
    process.exit(0);
  }
}

seedDatabase();
