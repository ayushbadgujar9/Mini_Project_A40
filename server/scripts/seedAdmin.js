/**
 * seedAdmin.js
 * Run once: npm run seed
 * Creates the initial admin account using ADMIN_SEED_PASSWORD from .env
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');

const ADMIN_DATA = {
  name: 'Super Admin',
  role: 'admin',
  adminId: 'ADMIN_001',
  password: process.env.ADMIN_SEED_PASSWORD || 'Admin@FairConnect2024',
};

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅  Connected to MongoDB');

    const existing = await User.findOne({ adminId: ADMIN_DATA.adminId });
    if (existing) {
      console.log(`ℹ️  Admin "${ADMIN_DATA.adminId}" already exists. Skipping.`);
      return;
    }

    const admin = new User(ADMIN_DATA);
    await admin.save();

    console.log('🎉  Admin account created successfully!');
    console.log(`    Admin ID : ${ADMIN_DATA.adminId}`);
    console.log(`    Password : ${ADMIN_DATA.password}`);
    console.log('    ⚠️  Change the password immediately after first login!');
  } catch (err) {
    console.error('❌  Seed failed:', err.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

seed();
