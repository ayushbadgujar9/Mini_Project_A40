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
      email: 'akulkarni.1011@gmail.com',
      phoneNumber: '+919000000000',
      adminId: 'ADMIN001',
      password: 'admin123',
      role: 'admin',
      verificationStatus: 'verified',
      isVerified: true,
      isEmailVerified: true,
    });
    await admin.save();

    console.log('  ✅ Admin Created:');
    console.log('     Name       : Platform Admin');
    console.log('     Email      : akulkarni.1011@gmail.com');
    console.log('     Phone      : +919000000000');
    console.log('     Admin ID   : ADMIN001');
    console.log('     Role       : admin');

    // ── 3. Seed Pending Worker Verifications ─────────────────────────────────
    console.log('\n👷 Seeding Pending Worker Verifications (Kolhapur Region)...');

    const workerDataList = [
      {
        name: 'Ramesh Patil',
        email: 'ramesh.patil@example.com',
        phoneNumber: '+919822012345',
        password: 'worker123',
        role: 'worker',
        verificationStatus: 'verified',
        isVerified: true,
        isEmailVerified: true,
        skills: ['masonry'],
        primarySkill: 'masonry',
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
        email: 'sunita.deshmukh@example.com',
        phoneNumber: '+919822054321',
        password: 'worker123',
        role: 'worker',
        verificationStatus: 'pending',
        isVerified: false,
        isEmailVerified: true,
        skills: ['plumbing'],
        primarySkill: 'plumbing',
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
        email: 'anand.shinde@example.com',
        phoneNumber: '+919822099887',
        password: 'worker123',
        role: 'worker',
        verificationStatus: 'pending',
        isVerified: false,
        isEmailVerified: true,
        skills: ['plumbing', 'electrician'],
        primarySkill: 'plumbing',
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
      {
        name: 'Ganesh Jadhav',
        email: 'ganesh.jadhav@example.com',
        phoneNumber: '+919822112233',
        password: 'worker123',
        role: 'worker',
        verificationStatus: 'verified',
        isVerified: true,
        isEmailVerified: true,
        skills: ['electrician', 'masonry'],
        primarySkill: 'electrician',
        city: 'Sangli',
        location: { type: 'Point', coordinates: [74.58, 16.85] },
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
      email: 'contact@apexconstructions.com',
      phoneNumber: '+919811122233',
      password: 'employer123',
      role: 'employer',
      verificationStatus: 'verified',
      isVerified: true,
      isEmailVerified: true,
      city: 'Kolhapur',
      location: { type: 'Point', coordinates: [74.24, 16.70] },
    });
    await employer.save();

    console.log(`  ✅ Employer Created: ${employer.name} (${employer.phoneNumber})`);

    const jobsData = [
      {
        title: 'Site Mason & Concrete Specialist',
        description: 'Need experienced masons for residential project in central Kolhapur.',
        requiredSkill: 'masonry',
        dailyWage: 850,
        city: 'Kolhapur',
        location: { type: 'Point', coordinates: [74.243, 16.704] }, // ~0.5 km from Kolhapur center
        status: 'open',
        isFlagged: false,
        employerId: employer._id,
      },
      {
        title: 'Residential Electrical Rewiring & Inverter Setup',
        description: 'Licensed electrician needed for complete flat rewiring, MCB board installation, and inverter connection.',
        requiredSkill: 'electrician',
        dailyWage: 900,
        city: 'Kolhapur',
        location: { type: 'Point', coordinates: [74.249, 16.711] }, // ~1.5 km away
        status: 'open',
        isFlagged: false,
        employerId: employer._id,
      },
      {
        title: 'Commercial Electrical & Wiring Installation',
        description: 'Electrician needed for retail shop fit-out near Tarabai Park.',
        requiredSkill: 'electrician',
        dailyWage: 950,
        city: 'Kolhapur',
        location: { type: 'Point', coordinates: [74.262, 16.720] }, // ~3.2 km away
        status: 'open',
        isFlagged: false,
        employerId: employer._id,
      },
      {
        title: 'Boundary Brick Wall Construction & Plastering',
        description: 'Experienced mason required for boundary wall brick laying and cement plastering.',
        requiredSkill: 'masonry',
        dailyWage: 850,
        city: 'Kolhapur',
        location: { type: 'Point', coordinates: [74.285, 16.735] }, // ~6.1 km away
        status: 'open',
        isFlagged: false,
        employerId: employer._id,
      },
      {
        title: 'Commercial Complex Water Supply & Drainage',
        description: 'Certified plumber needed for multi-floor PVC water supply and drainage line layout.',
        requiredSkill: 'plumbing',
        dailyWage: 1050,
        city: 'Kolhapur',
        location: { type: 'Point', coordinates: [74.310, 16.760] }, // ~10.5 km away
        status: 'open',
        isFlagged: false,
        employerId: employer._id,
      },
      {
        title: 'Stone Retaining Wall Masonry Work',
        description: 'Mason needed for farmhouse boundary stone masonry on the outskirts of Uchgaon.',
        requiredSkill: 'masonry',
        dailyWage: 850,
        city: 'Kolhapur',
        location: { type: 'Point', coordinates: [74.360, 16.780] }, // ~15.8 km away
        status: 'open',
        isFlagged: false,
        employerId: employer._id,
      },
      // ── Sangli Jobs ────────────────────────────────────────────────────────
      {
        title: 'Sangli APMC Market Water Pipeline Fitting',
        description: 'Plumber required for municipal water connection and valve fitting in market yard.',
        requiredSkill: 'plumbing',
        dailyWage: 850,
        city: 'Sangli',
        location: { type: 'Point', coordinates: [74.582, 16.853] }, // Sangli center
        status: 'open',
        isFlagged: false,
        employerId: employer._id,
      },
      {
        title: 'Sangli Textile Factory Main Board Wiring',
        description: 'Electrician needed for three-phase line distribution and capacitor bank setup.',
        requiredSkill: 'electrician',
        dailyWage: 950,
        city: 'Sangli',
        location: { type: 'Point', coordinates: [74.591, 16.859] }, // ~1.2 km from Sangli center
        status: 'open',
        isFlagged: false,
        employerId: employer._id,
      },
      // ── Pune Jobs ──────────────────────────────────────────────────────────
      {
        title: 'Pune High-Rise Construction Site Mason',
        description: 'Skilled brick masonry workers needed for new commercial tower in Pune.',
        requiredSkill: 'masonry',
        dailyWage: 950,
        city: 'Pune',
        location: { type: 'Point', coordinates: [73.858, 18.522] }, // Pune center / Shivajinagar
        status: 'open',
        isFlagged: false,
        employerId: employer._id,
      },
      {
        title: 'Pune Industrial Substation Electrician',
        description: 'Urgent requirement for industrial electricians at manufacturing unit in Pune.',
        requiredSkill: 'electrician',
        dailyWage: 1100,
        city: 'Pune',
        location: { type: 'Point', coordinates: [73.845, 18.515] }, // ~1.5 km from Pune center
        status: 'open',
        isFlagged: false,
        employerId: employer._id,
      },
      // ── Jalgaon Jobs ───────────────────────────────────────────────────────
      {
        title: 'Jalgaon Agricultural Drip Irrigation Plumbing',
        description: 'Experienced plumber needed for agricultural pump installation and drip irrigation lines.',
        requiredSkill: 'plumbing',
        dailyWage: 750,
        city: 'Jalgaon',
        location: { type: 'Point', coordinates: [75.564, 21.009] }, // Jalgaon center
        status: 'open',
        isFlagged: false,
        employerId: employer._id,
      },
      {
        title: 'Jalgaon Commercial Complex Electrician',
        description: 'Licensed electrician needed for commercial wiring and transformer maintenance.',
        requiredSkill: 'electrician',
        dailyWage: 850,
        city: 'Jalgaon',
        location: { type: 'Point', coordinates: [75.560, 21.005] }, // Jalgaon center
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
        location: { type: 'Point', coordinates: [74.254, 16.701] },
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
    console.log(`   - Job Listings : ${jobsData.length} (1 Flagged for Moderation)`);
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
