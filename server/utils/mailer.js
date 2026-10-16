const nodemailer = require('nodemailer');

// ──────────────────────────────────────────────────────────────────────────────
// Check if real SMTP credentials are configured (Brevo or custom)
// ──────────────────────────────────────────────────────────────────────────────
function isSmtpConfigured() {
  const user = (process.env.SMTP_USER || '').trim();
  const pass = (process.env.SMTP_PASS || '').trim();

  if (!user || !pass) return false;
  if (
    user.includes('your-email') ||
    user.includes('example.com') ||
    user.includes('your_brevo')
  ) {
    return false;
  }
  if (
    pass.includes('your-app-pass') ||
    pass.includes('your_brevo_smtp_key') ||
    pass.includes('your-key')
  ) {
    return false;
  }
  return true;
}

// ──────────────────────────────────────────────────────────────────────────────
// Create Nodemailer Transporter (optimized for Brevo / standard SMTP)
// Brevo defaults: Host = smtp-relay.brevo.com, Port = 587 (STARTTLS)
// ──────────────────────────────────────────────────────────────────────────────
function createTransporter() {
  const port = parseInt(process.env.SMTP_PORT, 10) || 587;
  const isSecure = port === 465;

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp-relay.brevo.com',
    port,
    secure: isSecure, // true for 465 (SSL), false for 587 (STARTTLS)
    auth: {
      user: (process.env.SMTP_USER || '').trim(),
      pass: (process.env.SMTP_PASS || '').trim(),
    },
    connectionTimeout: 10000, // 10s connection timeout for responsive OTPs
    greetingTimeout: 10000,
  });
}

// Singleton transporter instance for reuse
const transporter = createTransporter();

// ──────────────────────────────────────────────────────────────────────────────
// Verify Brevo SMTP connection
// ──────────────────────────────────────────────────────────────────────────────
async function verifySmtpConnection() {
  const transport = createTransporter();
  return transport.verify();
}

// ──────────────────────────────────────────────────────────────────────────────
// Generic send helper with Brevo support & dev fallback
// ──────────────────────────────────────────────────────────────────────────────
async function sendMail({ to, subject, html, text, otpCode }) {
  if (!isSmtpConfigured()) {
    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║ 📨 [DEV MODE OTP EMAIL — Brevo SMTP not configured]');
    console.log(`║ To: ${to}`);
    if (otpCode) {
      console.log(`║ 🔑 Verification OTP: >>> ${otpCode} <<<`);
    }
    console.log(`║ Subject: ${subject}`);
    console.log('║ ℹ️  To send real emails, add your Brevo SMTP key in server/.env');
    console.log('╚══════════════════════════════════════════════════════════╝\n');
    return { messageId: 'dev-mock-id', response: 'Logged to dev console' };
  }

  const transport = createTransporter();
  const fromEmail = (process.env.SMTP_FROM || process.env.SMTP_USER || '').trim();
  const fromName = (process.env.SMTP_FROM_NAME || 'FairConnect').trim();

  try {
    const info = await transport.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to,
      subject,
      html,
      text,
    });
    console.log(`✅ [Brevo SMTP] Real-time email sent to ${to}. (MessageId: ${info.messageId})`);
    return info;
  } catch (err) {
    console.error(`❌ [Brevo SMTP Error] Failed to send email to ${to}: ${err.message}`);

    if (err.responseCode === 535 || err.message.includes('Invalid login') || err.message.includes('Authentication')) {
      console.error('👉 Tip: Check your Brevo SMTP login (SMTP_USER) and SMTP key (SMTP_PASS) in server/.env');
    } else if (err.message.includes('sender') || err.message.includes('Sender') || err.responseCode === 550) {
      console.error(`👉 Tip: Brevo requires the sender address "${fromEmail}" to be a verified sender in your Brevo account (Settings -> Senders & IP).`);
    }

    if (otpCode) {
      console.log(`📨 [FALLBACK OTP for ${to}]: >>> ${otpCode} <<<`);
    }
    throw err;
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Send OTP verification email
// ──────────────────────────────────────────────────────────────────────────────
async function sendOtpEmail(toEmail, otpCode) {
  const subject = 'FairConnect — Your Email Verification Code';

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head><meta charset="UTF-8" /></head>
    <body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background:#f8fafc;">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:40px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
        <!-- Accent Bar -->
        <tr><td style="height:4px;background:linear-gradient(135deg,#10b981,#059669);"></td></tr>

        <!-- Logo -->
        <tr>
          <td style="padding:32px 36px 0;">
            <table cellpadding="0" cellspacing="0"><tr>
              <td style="width:42px;height:42px;background:linear-gradient(135deg,#10b981,#059669);border-radius:10px;text-align:center;vertical-align:middle;font-size:20px;">🔗</td>
              <td style="padding-left:12px;font-size:22px;font-weight:800;color:#0f172a;letter-spacing:-0.5px;">FairConnect</td>
            </tr></table>
          </td>
        </tr>

        <!-- Content -->
        <tr>
          <td style="padding:28px 36px 0;">
            <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f172a;">Verify Your Email</h1>
            <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.6;">
              Use the 6-digit code below to complete your email verification. This code is valid for <strong>5 minutes</strong>.
            </p>
          </td>
        </tr>

        <!-- OTP Box -->
        <tr>
          <td style="padding:0 36px;">
            <div style="background:#f0fdf4;border:2px solid #bbf7d0;border-radius:12px;padding:20px;text-align:center;">
              <span style="font-family:'Courier New',monospace;font-size:36px;font-weight:800;letter-spacing:10px;color:#059669;">${otpCode}</span>
            </div>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:24px 36px 32px;">
            <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.5;">
              If you didn't request this code, please ignore this email. Do not share this code with anyone.
            </p>
          </td>
        </tr>

        <!-- Bottom bar -->
        <tr><td style="height:4px;background:linear-gradient(135deg,#10b981,#059669);"></td></tr>
      </table>
    </body>
    </html>
  `;

  const text = `FairConnect — Email Verification\n\nYour 6-digit verification code is: ${otpCode}\n\nThis code is valid for 5 minutes. If you didn't request this, please ignore this email.`;

  return sendMail({ to: toEmail, subject, html, text, otpCode });
}

module.exports = {
  transporter,
  createTransporter,
  verifySmtpConnection,
  isSmtpConfigured,
  sendMail,
  sendOtpEmail,
};
