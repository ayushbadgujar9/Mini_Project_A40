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

  // 4. Try sending plain-text code via Brevo SMTP
  let emailSent = false;
  const isConfigured = isSmtpConfigured();
  const isDev = process.env.NODE_ENV !== 'production';

  console.log(`🔑 [OTP Code Generated for ${normalizedEmail}]: ${plainOtp}`);

  if (isConfigured) {
    try {
      await sendOtpEmail(normalizedEmail, plainOtp);
      emailSent = true;
    } catch (emailErr) {
      console.warn(`⚠️  Email delivery failed (${emailErr.message}). OTP will be shown on screen as fallback.`);
      emailSent = false;
    }
  } else {
    // Dev mode — just log to console
    await sendOtpEmail(normalizedEmail, plainOtp);
  }

  return {
    success: true,
    email: normalizedEmail,
    expiresInSeconds: 300,
    // Show OTP on frontend if SMTP is not configured OR if email failed to send
    devOtp: emailSent ? undefined : plainOtp,
    emailSent,
  };
}

module.exports = { generateAndSendOTP };
