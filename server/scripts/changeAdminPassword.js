/**
 * changeAdminPassword.js
 * Run: node scripts/changeAdminPassword.js
 * Changes the password for the admin account (ADMIN_001)
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');

// ── Set your new password here ─────────────────────────────────────────────
const ADMIN_ID = 'ADMIN_001';
const NEW_PASSWORD = 'Balu123';   // ← change this
// ──────────────────────────────────────────────────────────────────────────

async function changePassword() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅  Connected to MongoDB\n');

    const admin = await User.findOne({ adminId: ADMIN_ID }).select('+password');
    if (!admin) {
      console.error(`❌  Admin with ID "${ADMIN_ID}" not found.`);
      return;
    }

    // Assigning to .password triggers the pre-save bcrypt hook automatically
    admin.password = NEW_PASSWORD;
    await admin.save();

    console.log(`🎉  Password updated successfully for Admin: ${ADMIN_ID}`);
    console.log(`    New password : ${NEW_PASSWORD}`);
    console.log('    ⚠️  Keep this safe and do not share it!');
  } catch (err) {
    console.error('❌  Error:', err.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

changePassword();
