const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');

const User = require('../models/User');
const Job = require('../models/Job');
let Application;
try {
  Application = require('../models/Application');
} catch (_) {
  Application = null;
}

async function displayDatabase(uri, isMemory = false) {
  console.log('\n================================================================================');
  console.log(`🗄️   FAIRCONNECT DATABASE EXPLORER ${isMemory ? '(In-Memory Demo Instance)' : ''}`);
  console.log(`📍  Connected to: ${uri}`);
  console.log('================================================================================\n');

  // 1. Collections Overview
  const collections = await mongoose.connection.db.listCollections().toArray();
  console.log('📦  COLLECTIONS SUMMARY:');
  console.log('--------------------------------------------------------------------------------');
  for (const col of collections) {
    const count = await mongoose.connection.db.collection(col.name).countDocuments();
    console.log(` • ${col.name.padEnd(20)}: ${count} documents`);
  }
  console.log('--------------------------------------------------------------------------------\n');

  // 2. Users Collection
  const users = await User.find({}).lean();
  console.log(`👤  USERS COLLECTION (${users.length} records):`);
  console.log('--------------------------------------------------------------------------------');
  if (users.length === 0) {
    console.log(' (No users found)');
  } else {
    users.forEach((u, idx) => {
      console.log(`[${idx + 1}] ID: ${u._id}`);
      console.log(`    Name    : ${u.name}`);
      console.log(`    Email   : ${u.email || 'N/A'}`);
      console.log(`    Role    : ${u.role?.toUpperCase()}`);
      console.log(`    Phone   : ${u.phoneNumber || 'N/A'}`);
      console.log(`    Status  : verificationStatus: ${u.verificationStatus || 'unverified'} | isVerified: ${u.isVerified}`);
      if (u.role === 'worker') {
        console.log(`    Skills  : [${(u.skills || []).join(', ')}] (Primary: ${u.primarySkill || 'N/A'})`);
        console.log(`    Location: City: ${u.city || 'N/A'} | Coords: [${u.location?.coordinates?.join(', ') || 'N/A'}]`);
        console.log(`    Jobs Done: ${u.totalJobsCompleted || 0}`);
      }
      if (u.adminId) {
        console.log(`    AdminID : ${u.adminId}`);
      }
      console.log('');
    });
  }

  // 3. Jobs Collection
  const jobs = await Job.find({}).populate('employerId', 'name email phoneNumber').lean();
  console.log(`💼  JOBS COLLECTION (${jobs.length} records):`);
  console.log('--------------------------------------------------------------------------------');
  if (jobs.length === 0) {
    console.log(' (No jobs found)');
  } else {
    jobs.forEach((j, idx) => {
      console.log(`[${idx + 1}] ID: ${j._id}`);
      console.log(`    Title       : ${j.title}`);
      console.log(`    Skill       : ${j.requiredSkill} | Wage: ₹${j.dailyWage}/day`);
      console.log(`    City        : ${j.city || 'N/A'} | Status: ${j.status} | Flagged: ${j.isFlagged ? '⚠️ YES (' + j.flagReason + ')' : 'No'}`);
      console.log(`    Employer    : ${j.employerId?.name || j.employerId || 'Unknown'} (${j.employerId?.email || 'N/A'})`);
      if (j.hiredWorkerId) {
        console.log(`    Hired Worker: ${j.hiredWorkerId}`);
      }
      console.log('');
    });
  }

  // 4. Applications Collection
  if (Application) {
    const apps = await Application.find({}).populate('job', 'title').populate('worker', 'name email').lean();
    console.log(`📄  APPLICATIONS COLLECTION (${apps.length} records):`);
    console.log('--------------------------------------------------------------------------------');
    if (apps.length === 0) {
      console.log(' (No applications found)');
    } else {
      apps.forEach((a, idx) => {
        console.log(`[${idx + 1}] ID: ${a._id}`);
        console.log(`    Job     : ${a.job?.title || a.job}`);
        console.log(`    Worker  : ${a.worker?.name || a.worker}`);
        console.log(`    Status  : ${a.status}`);
        console.log(`    Date    : ${a.appliedAt || a.createdAt}`);
        console.log('');
      });
    }
  }

  console.log('================================================================================\n');
}

async function main() {
  const targetUri = process.env.MONGO_URI || 'mongodb://localhost:27017/fairconnect';
  let connected = false;

  try {
    console.log(`🔍 Attempting connection to MongoDB at: ${targetUri} ...`);
    await mongoose.connect(targetUri, { serverSelectionTimeoutMS: 2000 });
    connected = true;
    await displayDatabase(targetUri, false);
  } catch (err) {
    console.log(`\n⚠️  Could not connect to standalone MongoDB at ${targetUri}`);
    console.log(`   Reason: ${err.message}`);
    console.log('\n💡 FairConnect backend includes an embedded in-memory MongoDB (MongoMemoryServer)');
    console.log('   Spinning up preview instance with initial seed data to inspect schema and records...\n');

    try {
      const { MongoMemoryServer } = require('mongodb-memory-server');
      const mongod = await MongoMemoryServer.create();
      const memUri = mongod.getUri();
      await mongoose.connect(memUri);

      // Seed initial demo data matching server.js
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

      await displayDatabase(memUri, true);
      await mongod.stop();
    } catch (memErr) {
      console.error('Failed to run in-memory inspector:', memErr.message);
    }
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    process.exit(0);
  }
}

main();
