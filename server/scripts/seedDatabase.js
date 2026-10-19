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
    try {
      await User.collection.dropIndexes();
    } catch (_) {}
    await User.deleteMany({});
    await Job.deleteMany({});
    if (Application) {
      await Application.deleteMany({});
    }
    console.log('✅ Existing collection data cleared.');

    // ── 2. Seed System Admin Accounts ────────────────────────────────────────
    console.log('👤 Seeding System Admin Accounts...');

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

    const admin2 = new User({
      name: 'System Admin',
      email: 'admin@fairconnect.com',
      phoneNumber: '+919000000001',
      adminId: 'ADMIN002',
      password: 'admin123',
      role: 'admin',
      verificationStatus: 'verified',
      isVerified: true,
      isEmailVerified: true,
    });
    await admin2.save();

    console.log('  ✅ Admins Created:');
    console.log('     Primary Admin   : akulkarni.1011@gmail.com (ADMIN001)');
    console.log('     Secondary Admin : admin@fairconnect.com (ADMIN002)');
    console.log('     Password        : admin123');

    // ── 3. Seed Worker Accounts ──────────────────────────────────────────────
    console.log('\n👷 Seeding Worker Accounts (Verified & Pending Verifications)...');

    const workerDataList = [
      {
        name: 'Ramesh Patil',
        email: 'ramesh.patil@example.com',
        phoneNumber: '+919822012345',
        password: 'worker123',
        role: 'worker',
        verificationStatus: 'unverified',
        isVerified: false,
        isEmailVerified: true,
        skills: ['masonry', 'construction'],
        primarySkill: 'masonry',
        city: 'Kolhapur',
        dateOfBirth: new Date('1990-05-12'),
        yearsOfExperience: 8,
        expectedDailyWage: 850,
        bio: 'Experienced mason with 8+ years in residential and commercial construction. Skilled in brickwork, plastering, and concrete work.',
        location: { type: 'Point', coordinates: [74.24, 16.70] },
        totalJobsCompleted: 14,
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
        skills: ['plumbing', 'housekeeping', 'cooking'],
        primarySkill: 'plumbing',
        city: 'Kolhapur',
        dateOfBirth: new Date('1993-08-22'),
        yearsOfExperience: 4,
        expectedDailyWage: 700,
        bio: 'Plumber with experience in residential pipeline fitting and bathroom installation. Also skilled in housekeeping.',
        location: { type: 'Point', coordinates: [74.25, 16.71] },
        idCardUrl: 'https://placehold.co/600x400?text=Worker+ID+Card+2',
        idImagePath: 'https://placehold.co/600x400?text=Worker+ID+Card+2',
        ocrData: {
          extractedName: 'Sunita Deshmukh',
          mockDocRef: 'MOCK_DOC_1002',
          ocrMatchScore: '88%',
        },
        ocrExtractedText: 'GOVERNMENT OF INDIA - AADHAAR CARD\nName: Sunita Deshmukh\nDOB: 22/08/1993\nID Ref: MOCK_DOC_1002\nMatch Score: 88%',
        totalJobsCompleted: 4,
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
        skills: ['plumbing', 'electrician', 'electrical'],
        primarySkill: 'plumbing',
        city: 'Kolhapur',
        dateOfBirth: new Date('1988-11-10'),
        yearsOfExperience: 6,
        expectedDailyWage: 800,
        bio: 'Versatile worker with expertise in both plumbing and electrical wiring. Handled multiple apartment projects in Kolhapur.',
        location: { type: 'Point', coordinates: [74.23, 16.69] },
        idCardUrl: 'https://placehold.co/600x400?text=Worker+ID+Card+3',
        idImagePath: 'https://placehold.co/600x400?text=Worker+ID+Card+3',
        ocrData: {
          extractedName: 'Anand Shinde',
          mockDocRef: 'MOCK_DOC_1003',
          ocrMatchScore: '91%',
        },
        ocrExtractedText: 'ELECTION COMMISSION OF INDIA - VOTER ID\nName: Anand Shinde\nDOB: 10/11/1988\nID Ref: MOCK_DOC_1003\nMatch Score: 91%',
        totalJobsCompleted: 7,
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
        dateOfBirth: new Date('1985-03-19'),
        yearsOfExperience: 12,
        expectedDailyWage: 950,
        bio: 'Certified electrician with 12 years of experience in residential, commercial, and industrial electrical projects across Sangli and Kolhapur.',
        location: { type: 'Point', coordinates: [74.58, 16.85] },
        totalJobsCompleted: 9,
      },
    ];

    const seededWorkers = [];
    for (const wData of workerDataList) {
      const w = new User(wData);
      await w.save();
      seededWorkers.push(w);
      console.log(`  ✅ Worker Created: ${w.name} (${w.phoneNumber}) - Verification: ${w.verificationStatus} - Skills: ${w.skills.join(', ')}`);
    }

    // ── 4. Seed Employer & Job Listings ───────────────────────────────────────
    console.log('\n🏢 Seeding Employers & Job Listings for Admin Moderation Queue...');

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

    const employer2 = new User({
      name: 'Apex Constructions (Secondary)',
      email: 'employer@apexconstructions.com',
      phoneNumber: '+919811122234',
      password: 'employer123',
      role: 'employer',
      verificationStatus: 'verified',
      isVerified: true,
      isEmailVerified: true,
      city: 'Kolhapur',
      location: { type: 'Point', coordinates: [74.24, 16.70] },
    });
    await employer2.save();

    console.log(`  ✅ Employers Created: ${employer.name} (${employer.email}) & (${employer2.email})`);

    const jobsData = [
      // ── Kolhapur Jobs ───────────────────────────────────────────────────────
      {
        title: 'Site Mason & Concrete Specialist',
        description: 'Need experienced masons for residential project in central Kolhapur.',
        requiredSkill: 'masonry',
        category: 'Construction / Masonry',
        skillsRequired: ['masonry', 'construction', 'concrete', 'brickwork'],
        dailyWage: 850,
        city: 'Kolhapur',
        location: { type: 'Point', coordinates: [74.243, 16.704] }, // ~0.5 km from Kolhapur center
        status: 'open',
        isFlagged: false,
        employerId: employer._id,
      },
      {
        title: 'Residential Pipeline & Sanitary Plumbing',
        description: 'Need licensed plumber for residential bathroom fittings, leak detection, and pipe repairs.',
        requiredSkill: 'plumbing',
        category: 'Plumbing',
        skillsRequired: ['plumbing', 'pipe fitting', 'leak repair', 'sanitary'],
        dailyWage: 900,
        city: 'Kolhapur',
        location: { type: 'Point', coordinates: [74.245, 16.707] }, // ~0.8 km away
        status: 'open',
        isFlagged: false,
        employerId: employer._id,
      },
      {
        title: 'Residential Electrical Rewiring & Inverter Setup',
        description: 'Licensed electrician needed for complete flat rewiring, MCB board installation, and inverter connection.',
        requiredSkill: 'electrician',
        category: 'Electrical',
        skillsRequired: ['electrician', 'electrical', 'wiring', 'inverter'],
        dailyWage: 900,
        city: 'Kolhapur',
        location: { type: 'Point', coordinates: [74.249, 16.711] }, // ~1.5 km away
        status: 'open',
        isFlagged: false,
        employerId: employer._id,
      },
      {
        title: 'Residential Interior Painting & Finishing',
        description: 'Skilled painters needed for a 2-BHK apartment near Rajarampuri.',
        requiredSkill: 'painting',
        category: 'Painting',
        skillsRequired: ['painting', 'interior painting', 'whitewashing', 'finishing'],
        dailyWage: 750,
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
        category: 'Electrical',
        skillsRequired: ['electrician', 'electrical', 'wiring', 'installation', 'switchboard'],
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
        category: 'Construction / Masonry',
        skillsRequired: ['masonry', 'construction', 'brickwork', 'plastering'],
        dailyWage: 850,
        city: 'Kolhapur',
        location: { type: 'Point', coordinates: [74.285, 16.735] }, // ~6.1 km away
        status: 'open',
        isFlagged: false,
        employerId: employer._id,
      },
      {
        title: 'Deep Housekeeping & Sanitization Services',
        description: 'Housekeeping staff required for thorough office and residential cleaning in central Kolhapur.',
        requiredSkill: 'cleaning',
        category: 'Housekeeping / Cleaning',
        skillsRequired: ['cleaning', 'housekeeping', 'sanitization', 'sweeping'],
        dailyWage: 680,
        city: 'Kolhapur',
        location: { type: 'Point', coordinates: [74.241, 16.702] }, // ~0.4 km away
        status: 'open',
        isFlagged: false,
        employerId: employer._id,
      },
      {
        title: 'Furniture Carpentry & Door Fitting',
        description: 'Experienced carpenter required for custom wardrobes and fittings in Shiroli.',
        requiredSkill: 'carpentry',
        category: 'Construction / Masonry',
        skillsRequired: ['carpentry', 'woodwork', 'furniture fitting'],
        dailyWage: 800,
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
        category: 'Plumbing',
        skillsRequired: ['plumbing', 'drainage', 'pipe fitting'],
        dailyWage: 1050,
        city: 'Kolhapur',
        location: { type: 'Point', coordinates: [74.310, 16.760] }, // ~10.5 km away
        status: 'open',
        isFlagged: false,
        employerId: employer._id,
      },
      {
        title: 'Heavy Structural Welding & Fabrication',
        description: 'Certified arc welder needed for shed fabrication work in Gokul Shirgaon MIDC.',
        requiredSkill: 'welding',
        category: 'Construction / Masonry',
        skillsRequired: ['welding', 'fabrication', 'arc welding'],
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
        category: 'Construction / Masonry',
        skillsRequired: ['masonry', 'stone work', 'boundary wall'],
        dailyWage: 850,
        city: 'Kolhapur',
        location: { type: 'Point', coordinates: [74.360, 16.780] }, // ~15.8 km away
        status: 'open',
        isFlagged: false,
        employerId: employer._id,
      },
      {
        title: 'Garden Landscaping & Pruning',
        description: 'Gardener needed for farmhouse landscaping on the outskirts of Uchgaon.',
        requiredSkill: 'gardening',
        category: 'Agriculture / Gardening',
        skillsRequired: ['gardening', 'agriculture', 'pruning', 'landscaping'],
        dailyWage: 650,
        city: 'Kolhapur',
        location: { type: 'Point', coordinates: [74.360, 16.780] }, // ~15.8 km away
        status: 'open',
        isFlagged: false,
        employerId: employer._id,
      },
      {
        title: 'Kolhapur Warehouse Loading & Unskilled Helper',
        description: 'Physical helpers needed for unloading transport trucks and shifting building supplies.',
        requiredSkill: 'construction',
        category: 'Helper / Unskilled',
        skillsRequired: ['helper', 'unskilled', 'loading', 'shifting'],
        dailyWage: 650,
        city: 'Kolhapur',
        location: { type: 'Point', coordinates: [74.247, 16.709] }, // ~1.1 km away
        status: 'open',
        isFlagged: false,
        employerId: employer._id,
      },

      // ── Sangli Jobs ────────────────────────────────────────────────────────
      {
        title: 'Sangli APMC Market Water Pipeline Fitting',
        description: 'Plumber required for municipal water connection and valve fitting in market yard.',
        requiredSkill: 'plumbing',
        category: 'Plumbing',
        skillsRequired: ['plumbing', 'pipeline', 'valve fitting'],
        dailyWage: 850,
        city: 'Sangli',
        location: { type: 'Point', coordinates: [74.582, 16.853] }, // Sangli center
        status: 'open',
        isFlagged: false,
        employerId: employer._id,
      },
      {
        title: 'Sangli Turmeric Market Warehouse Loader',
        description: 'Need active workers for turmeric bag loading and stacking in Sangli APMC market.',
        requiredSkill: 'cleaning',
        category: 'Helper / Unskilled',
        skillsRequired: ['helper', 'unskilled', 'loading', 'warehouse'],
        dailyWage: 700,
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
        category: 'Electrical',
        skillsRequired: ['electrician', 'electrical', 'wiring', 'three-phase'],
        dailyWage: 950,
        city: 'Sangli',
        location: { type: 'Point', coordinates: [74.591, 16.859] }, // ~1.2 km from Sangli center
        status: 'open',
        isFlagged: false,
        employerId: employer._id,
      },
      {
        title: 'Sangli Textile Factory Woodwork & Fitting',
        description: 'Skilled carpentry and wooden frame repair for local weaving unit in Sangli.',
        requiredSkill: 'carpentry',
        category: 'Construction / Masonry',
        skillsRequired: ['carpentry', 'woodwork'],
        dailyWage: 800,
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
        category: 'Construction / Masonry',
        skillsRequired: ['construction', 'masonry', 'brickwork'],
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
        category: 'Electrical',
        skillsRequired: ['electrician', 'electrical', 'substation', 'industrial'],
        dailyWage: 1100,
        city: 'Pune',
        location: { type: 'Point', coordinates: [73.845, 18.515] }, // ~1.5 km from Pune center
        status: 'open',
        isFlagged: false,
        employerId: employer._id,
      },
      {
        title: 'Pune Industrial Fabrication & Welder',
        description: 'Urgent requirement for arc welders at industrial manufacturing unit in Pune.',
        requiredSkill: 'welding',
        category: 'Construction / Masonry',
        skillsRequired: ['welding', 'fabrication'],
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
        category: 'Plumbing',
        skillsRequired: ['plumbing', 'irrigation', 'pump installation'],
        dailyWage: 750,
        city: 'Jalgaon',
        location: { type: 'Point', coordinates: [75.564, 21.009] }, // Jalgaon center
        status: 'open',
        isFlagged: false,
        employerId: employer._id,
      },
      {
        title: 'Jalgaon Banana Farm Harvest & Sorting Specialist',
        description: 'Experienced agricultural workers needed for harvest, packaging and tree care.',
        requiredSkill: 'gardening',
        category: 'Agriculture / Gardening',
        skillsRequired: ['gardening', 'agriculture', 'farming', 'harvesting'],
        dailyWage: 650,
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
        category: 'Electrical',
        skillsRequired: ['electrician', 'electrical', 'wiring', 'installation'],
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
        category: 'Plumbing',
        skillsRequired: ['plumbing', 'pipe repairs'],
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
    console.log('   - Admin Users  : 2 (akulkarni.1011@gmail.com, admin@fairconnect.com)');
    console.log('   - Workers      : 4 (2 Verified, 2 Pending Verification)');
    console.log('   - Employers    : 2 (contact@apexconstructions.com, employer@apexconstructions.com)');
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
