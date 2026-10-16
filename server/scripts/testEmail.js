require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { verifySmtpConnection, sendOtpEmail, isSmtpConfigured } = require('../utils/mailer');

async function testBrevoEmail() {
  console.log('\n======================================================');
  console.log('       FairConnect — Brevo SMTP Diagnostics & Test     ');
  console.log('======================================================\n');

  const host = process.env.SMTP_HOST || 'smtp-relay.brevo.com';
  const port = process.env.SMTP_PORT || '587';
  const user = process.env.SMTP_USER || '';
  const pass = process.env.SMTP_PASS || '';
  const from = process.env.SMTP_FROM || user;
  const fromName = process.env.SMTP_FROM_NAME || 'FairConnect';

  console.log(`📡 SMTP Server  : ${host}:${port}`);
  console.log(`👤 SMTP Login   : ${user || '(not set)'}`);
  console.log(`🔑 SMTP Key     : ${pass ? (pass.length > 8 ? `${pass.substring(0, 8)}... (len: ${pass.length})` : '***') : '(not set)'}`);
  console.log(`✉️  Sender (From): "${fromName}" <${from || '(not set)'}>`);
  console.log(`⚙️  Configured?  : ${isSmtpConfigured() ? '✅ YES' : '❌ NO (Placeholder / empty detected)'}\n`);

  if (!isSmtpConfigured()) {
    console.log('⚠️  Brevo SMTP is not fully configured in server/.env.');
    console.log('Please set:');
    console.log('  SMTP_HOST=smtp-relay.brevo.com');
    console.log('  SMTP_PORT=587');
    console.log('  SMTP_USER=your_brevo_account_or_smtp_login');
    console.log('  SMTP_PASS=your_brevo_smtp_key');
    console.log('  SMTP_FROM=your_verified_sender_email\n');
    process.exit(1);
  }

  // Step 1: Verify Connection & Credentials
  console.log('1️⃣  Connecting to Brevo SMTP server...');
  try {
    await verifySmtpConnection();
    console.log('✅  Brevo SMTP Authentication Successful! Connection is verified.\n');
  } catch (err) {
    console.error('❌  Brevo SMTP Verification Failed:', err.message);
    if (err.responseCode === 535 || err.message.includes('Authentication') || err.message.includes('Invalid login')) {
      console.error('\n👉 Probable cause: Invalid Brevo SMTP User or SMTP Key.');
      console.error('   1. Go to Brevo -> Top-right profile menu -> SMTP & API -> SMTP tab.');
      console.error('   2. Confirm your Login (SMTP_USER) and generate a new SMTP key (SMTP_PASS).');
    }
    process.exit(1);
  }

  // Step 2: Send Test OTP Email (if recipient provided)
  const targetEmail = process.argv[2] || from;
  if (!targetEmail || targetEmail.includes('your-email') || targetEmail.includes('example.com')) {
    console.log('ℹ️  No valid recipient email provided to send a test message.');
    console.log('To send a real test OTP email, run:');
    console.log('   node scripts/testEmail.js your_real_email@example.com\n');
    process.exit(0);
  }

  console.log(`2️⃣  Sending real-time test OTP email to: ${targetEmail}...`);
  const testOtp = String(Math.floor(100000 + Math.random() * 900000));

  try {
    const info = await sendOtpEmail(targetEmail, testOtp);
    console.log(`\n🎉 SUCCESS! Real-time OTP email sent successfully!`);
    console.log(`📨 Message ID : ${info.messageId}`);
    console.log(`🔑 Test OTP   : ${testOtp}`);
    console.log(`📬 Recipient  : ${targetEmail}`);
    console.log(`👉 Please check your inbox (and spam folder) to verify receipt.\n`);
  } catch (err) {
    console.error(`\n❌  Failed to send test email: ${err.message}`);
    if (err.responseCode === 550 || err.message.includes('sender') || err.message.includes('Sender')) {
      console.error('\n👉 Probable cause: Sender email is not verified in Brevo.');
      console.error(`   In Brevo dashboard -> Senders & IP -> Senders, make sure "${from}" is listed and verified.`);
    }
    process.exit(1);
  }
}

testBrevoEmail().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
