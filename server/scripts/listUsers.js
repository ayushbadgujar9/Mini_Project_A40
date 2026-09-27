/**
 * listUsers.js
 * Run: node scripts/listUsers.js
 * Lists all registered users from MongoDB (passwords are hashed - not shown)
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');

async function listUsers() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅  Connected to MongoDB\n');

    const users = await User.find({}).select('+password').lean();

    if (users.length === 0) {
      console.log('⚠️  No users found in the database.');
      return;
    }

    console.log(`📋  Total Users: ${users.length}\n`);
    console.log('='.repeat(70));

    users.forEach((user, i) => {
      console.log(`\n👤  User ${i + 1}`);
      console.log(`    Name        : ${user.name}`);
      console.log(`    Role        : ${user.role}`);
      if (user.adminId)     console.log(`    Admin ID    : ${user.adminId}`);
      if (user.phoneNumber) console.log(`    Phone       : ${user.phoneNumber}`);
      console.log(`    Password    : ${user.password} (bcrypt hash)`);
      console.log(`    Verified    : ${user.isVerified}`);
      console.log(`    Created At  : ${user.createdAt}`);
      console.log('-'.repeat(70));
    });

  } catch (err) {
    console.error('❌  Error:', err.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

listUsers();
