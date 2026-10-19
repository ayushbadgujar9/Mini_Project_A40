const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const fs = require('fs');
const User = require('../models/User');
const Job = require('../models/Job');

async function startCompassServer() {
  console.log('\n================================================================================');
  console.log('🚀  STARTING MONGODB SERVER FOR MONGODB COMPASS');
  console.log('================================================================================\n');

  let mongod;
  let uri = 'mongodb://127.0.0.1:27017/fairconnect';
  let isAlreadyRunning = false;

  // 1. Check if MongoDB is already active (e.g., FairConnect backend dev server is running)
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 1500 });
    console.log('⚡ Detected MongoDB is ALREADY running on port 27017 (from your backend server)!');
    isAlreadyRunning = true;
  } catch (_connErr) {
    // 2. Not running, start persistent MongoMemoryServer on port 27017 with .mongodb_data
    const dbPath = path.join(__dirname, '../.mongodb_data');
    if (!fs.existsSync(dbPath)) fs.mkdirSync(dbPath, { recursive: true });

    try {
      mongod = await MongoMemoryServer.create({
        instance: {
          port: 27017,
          dbName: 'fairconnect',
          dbPath,
          storageEngine: 'wiredTiger',
        },
      });
      uri = mongod.getUri('fairconnect');
    } catch (_portErr) {
      console.log('⚠️  Port 27017 in use, switching to dynamic port...');
      mongod = await MongoMemoryServer.create({
        instance: {
          dbName: 'fairconnect',
          dbPath,
          storageEngine: 'wiredTiger',
        },
      });
      uri = mongod.getUri('fairconnect');
    }

    await mongoose.connect(uri);
  }

  // Seed demo data if empty
  const count = await User.countDocuments();
  if (count === 0) {
    console.log('🌱 Populating initial data for Compass (Users, Jobs, Admin)...');

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

    const workers = await User.create([
      {
        name: 'Ramesh Patil',
        phoneNumber: '+919822012345',
        role: 'worker',
        verificationStatus: 'verified',
        isVerified: true,
        isEmailVerified: true,
        email: 'ramesh.patil@example.com',
        skills: ['masonry', 'construction'],
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

    const employer1 = await User.create({
      name: 'Sunil Deshmukh',
      phoneNumber: '+919833012345',
      role: 'employer',
      verificationStatus: 'verified',
      isVerified: true,
      isEmailVerified: true,
      email: 'sunil.deshmukh@example.com',
      city: 'Kolhapur',
      location: { type: 'Point', coordinates: [74.24, 16.70] },
    });

    const employer2 = await User.create({
      name: 'Kavita Shinde',
      phoneNumber: '+919833054321',
      role: 'employer',
      verificationStatus: 'verified',
      isVerified: true,
      isEmailVerified: true,
      email: 'kavita.shinde@example.com',
      city: 'Kolhapur',
      location: { type: 'Point', coordinates: [74.26, 16.72] },
    });

    await Job.create([
      {
        title: 'Residential Brick Masonry & Plastering',
        description: 'Experienced mason needed for exterior wall construction and plastering.',
        requiredSkill: 'masonry',
        dailyWage: 850,
        city: 'Kolhapur',
        location: { type: 'Point', coordinates: [74.24, 16.70] },
        status: 'open',
        isFlagged: false,
        employerId: employer1._id,
      },
      {
        title: 'Full House Electrical Rewiring & Fitting',
        description: 'Certified electrician required for MCB installation and full house wiring.',
        requiredSkill: 'electrician',
        dailyWage: 950,
        city: 'Kolhapur',
        location: { type: 'Point', coordinates: [74.25, 16.71] },
        status: 'open',
        isFlagged: false,
        employerId: employer2._id,
      },
      {
        title: 'Bathroom Plumbing Line Fitting',
        description: 'CPVC pipe installation and sanitary fixture fitting for a renovated flat.',
        requiredSkill: 'plumbing',
        dailyWage: 900,
        city: 'Kolhapur',
        location: { type: 'Point', coordinates: [74.23, 16.69] },
        status: 'open',
        isFlagged: false,
        employerId: employer1._id,
      },
      {
        title: 'Commercial Panel Electrician',
        description: 'Industrial electrician needed for distribution board and power connections.',
        requiredSkill: 'electrician',
        dailyWage: 950,
        city: 'Sangli',
        location: { type: 'Point', coordinates: [74.58, 16.85] },
        status: 'open',
        isFlagged: false,
        employerId: employer1._id,
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
  }

  const userCount = await User.countDocuments();
  const jobCount = await Job.countDocuments();

  console.log('✅  MongoDB Server is READY and listening for Compass!');
  console.log(`📊  Current Database Status: ${userCount} Users, ${jobCount} Jobs`);
  console.log('--------------------------------------------------------------------------------');
  console.log('🧭  MONGODB COMPASS CONNECTION INSTRUCTIONS:');
  console.log(' 1. Open MongoDB Compass on your computer');
  console.log(' 2. Paste this URI into the "New Connection" field:');
  console.log(`    👉  ${uri}`);
  console.log(' 3. Click "Connect"');
  console.log(' 4. Look for the "fairconnect" database in the left sidebar');
  console.log('    You will see the collections: users, jobs, applications');
  console.log('--------------------------------------------------------------------------------');
  console.log('Press Ctrl + C anytime in this terminal to stop this script.\n');

  process.on('SIGINT', async () => {
    console.log('\n🛑 Stopping MongoDB Compass listener...');
    await mongoose.disconnect();
    if (mongod) {
      await mongod.stop();
    }
    process.exit(0);
  });

  // Keep alive
  setInterval(() => {}, 10000);
}

startCompassServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
