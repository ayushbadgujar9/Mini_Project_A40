const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { sendOtpEmail, isSmtpConfigured } = require('./mailer');

/**
 * generateAndSendOTP(email)
 * - Generates a 6-digit random code
 * - Hashes it using bcrypt
 * - Saves it to the user's document with a 5-minute expiration (currentOtp, otpExpiresAt)
 * - Emails the plain-text code via Brevo SMTP (or logs in dev mode if SMTP not configured)
 */
async function generateAndSendOTP(email) {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await User.findOne({ email: normalizedEmail });
  if (!user) {
    throw new Error('User not found.');
  }

  // 1. Generate 6-digit random code
  const plainOtp = String(crypto.randomInt(100000, 1000000));

  // 2. Hash using bcrypt
  const salt = await bcrypt.genSalt(10);
  const hashedOtp = await bcrypt.hash(plainOtp, salt);

  // 3. Save to user document with 5-minute expiration
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  user.currentOtp = hashedOtp;
  user.otpExpiresAt = expiresAt;
  user.emailOtp = hashedOtp;
  user.emailOtpExpiresAt = expiresAt;
  await user.save();

  // 4. Send plain-text code via Brevo SMTP
  await sendOtpEmail(normalizedEmail, plainOtp);

  const isConfigured = isSmtpConfigured();

  return {
    success: true,
    email: normalizedEmail,
    expiresInSeconds: 300,
    devOtp: isConfigured ? undefined : plainOtp,
  };
}

module.exports = { generateAndSendOTP };
