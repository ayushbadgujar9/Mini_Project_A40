import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

// ──────────────────────────────────────────────────────────────────────────────
// Inline SVG Icons
// ──────────────────────────────────────────────────────────────────────────────
const MailIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" />
  </svg>
);

const ShieldCheckIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><polyline points="9 12 11 14 15 10" />
  </svg>
);

const CheckCircleIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const ArrowLeftIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
  </svg>
);

// ──────────────────────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────────────────────
const OTP_LENGTH = 6;
const OTP_EXPIRY_SECONDS = 300; // 5 minutes

// ──────────────────────────────────────────────────────────────────────────────
// Phases: 'email' → 'otp' → 'success'
// ──────────────────────────────────────────────────────────────────────────────
export default function EmailVerification() {
  const navigate = useNavigate();
  const { user, token } = useAuth();

  const [phase, setPhase] = useState('email'); // 'email' | 'otp' | 'success'
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(Array(OTP_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  // Countdown state
  const [secondsLeft, setSecondsLeft] = useState(OTP_EXPIRY_SECONDS);
  const [canResend, setCanResend] = useState(false);
  const timerRef = useRef(null);

  // OTP input refs for auto-focus
  const inputRefs = useRef([]);

  // ── Auth header helper ──────────────────────────────────────────────────────
  const authHeaders = useCallback(
    () => ({ headers: { Authorization: `Bearer ${token}` } }),
    [token]
  );

  // ── Start countdown ─────────────────────────────────────────────────────────
  const startCountdown = useCallback(() => {
    setSecondsLeft(OTP_EXPIRY_SECONDS);
    setCanResend(false);

    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          setCanResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // ── Format mm:ss ────────────────────────────────────────────────────────────
  const formatTime = (s) => {
    const min = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  // ── Send OTP ────────────────────────────────────────────────────────────────
  const handleSendOtp = async (e) => {
    if (e) e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);

    try {
      await axios.post('/api/auth/send-email-otp', { email: email.trim() }, authHeaders());
      setPhase('otp');
      startCountdown();
      setInfo('A 6-digit code has been sent to your email.');
      // Auto-focus first OTP input after render
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Resend OTP ──────────────────────────────────────────────────────────────
  const handleResend = async () => {
    setOtp(Array(OTP_LENGTH).fill(''));
    await handleSendOtp();
  };

  // ── OTP Input Handlers ──────────────────────────────────────────────────────
  const handleOtpChange = (index, value) => {
    // Allow only digits
    if (value && !/^\d$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-advance to next input
    if (value && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (!pasted) return;
    const newOtp = Array(OTP_LENGTH).fill('');
    pasted.split('').forEach((ch, i) => (newOtp[i] = ch));
    setOtp(newOtp);
    // Focus the last filled or the next empty
    const focusIndex = Math.min(pasted.length, OTP_LENGTH - 1);
    inputRefs.current[focusIndex]?.focus();
  };

  // ── Confirm OTP ─────────────────────────────────────────────────────────────
  const handleConfirmOtp = async (e) => {
    if (e) e.preventDefault();
    setError('');
    setInfo('');
    const otpString = otp.join('');

    if (otpString.length !== OTP_LENGTH) {
      setError('Please enter the complete 6-digit code.');
      return;
    }

    setLoading(true);
    try {
      await axios.post('/api/auth/confirm-email-otp', { otp: otpString }, authHeaders());
      if (timerRef.current) clearInterval(timerRef.current);
      setPhase('success');

      // Auto-redirect to dashboard after 2.5s
      setTimeout(() => {
        navigate(`/${user?.role || 'worker'}/dashboard`, { replace: true });
      }, 2500);
    } catch (err) {
      setError(err.response?.data?.message || 'Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Progress bar percentage ─────────────────────────────────────────────────
  const progressPercent = (secondsLeft / OTP_EXPIRY_SECONDS) * 100;

  // ──────────────────────────────────────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────────────────────────────────────
  return (
    <main className="auth-page">
      <div className="glass-card email-verify-card">
        {/* Brand */}
        <div className="brand">
          <div className="brand-icon">🔗</div>
          <span className="brand-name">FairConnect</span>
        </div>

        {/* ── Phase: Email Input ──────────────────────────────────────────── */}
        {phase === 'email' && (
          <>
            <div className="ev-header">
              <div className="ev-icon-wrap">
                <ShieldCheckIcon />
              </div>
              <h1 className="page-title">Verify Your Email</h1>
              <p className="page-subtitle">
                Enter your email address to receive a verification code.
              </p>
            </div>

            {error && (
              <div className="alert alert-error" role="alert">
                <span>⚠️</span><span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSendOtp} noValidate>
              <div className="form-group">
                <label className="form-label" htmlFor="ev-email">Email Address</label>
                <div className="input-wrapper">
                  <span className="input-icon"><MailIcon /></span>
                  <input
                    id="ev-email"
                    type="email"
                    className="form-input"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    autoFocus
                  />
                </div>
              </div>

              <button
                id="ev-send-otp-btn"
                type="submit"
                className="btn-primary"
                disabled={loading || !email.trim()}
              >
                {loading && <span className="btn-spinner" />}
                {loading ? 'Sending…' : 'Send Verification Code'}
              </button>
            </form>

            <button
              className="ev-back-btn"
              onClick={() => navigate(-1)}
              type="button"
            >
              <ArrowLeftIcon /> Back
            </button>
          </>
        )}

        {/* ── Phase: OTP Entry ────────────────────────────────────────────── */}
        {phase === 'otp' && (
          <>
            <div className="ev-header">
              <div className="ev-icon-wrap">
                <ShieldCheckIcon />
              </div>
              <h1 className="page-title">Enter Verification Code</h1>
              <p className="page-subtitle">
                We sent a 6-digit code to <strong className="ev-email-highlight">{email}</strong>
              </p>
            </div>

            {/* Countdown timer */}
            <div className="ev-timer-wrap">
              <div className="ev-timer-bar">
                <div
                  className="ev-timer-fill"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="ev-timer-text">
                {secondsLeft > 0 ? (
                  <>
                    <span className="ev-timer-clock">⏱</span>
                    <span>Code expires in <strong>{formatTime(secondsLeft)}</strong></span>
                  </>
                ) : (
                  <span className="ev-timer-expired">Code expired — request a new one</span>
                )}
              </div>
            </div>

            {error && (
              <div className="alert alert-error" role="alert">
                <span>⚠️</span><span>{error}</span>
              </div>
            )}
            {info && (
              <div className="alert alert-success" role="status">
                <span>✅</span><span>{info}</span>
              </div>
            )}

            {/* OTP Boxes */}
            <form onSubmit={handleConfirmOtp} noValidate>
              <div className="ev-otp-group" onPaste={handleOtpPaste}>
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => (inputRefs.current[i] = el)}
                    id={`ev-otp-${i}`}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    className={`ev-otp-input ${digit ? 'filled' : ''}`}
                    value={digit}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    autoComplete="one-time-code"
                    aria-label={`Digit ${i + 1}`}
                  />
                ))}
              </div>

              <button
                id="ev-verify-btn"
                type="submit"
                className="btn-primary"
                disabled={loading || otp.join('').length !== OTP_LENGTH || secondsLeft === 0}
              >
                {loading && <span className="btn-spinner" />}
                {loading ? 'Verifying…' : 'Verify Code'}
              </button>
            </form>

            {/* Resend / Change email */}
            <div className="ev-actions">
              <button
                id="ev-resend-btn"
                type="button"
                className="ev-link-btn"
                onClick={handleResend}
                disabled={!canResend || loading}
              >
                {canResend ? '🔄 Resend Code' : `Resend available in ${formatTime(secondsLeft)}`}
              </button>

              <button
                type="button"
                className="ev-link-btn"
                onClick={() => {
                  if (timerRef.current) clearInterval(timerRef.current);
                  setPhase('email');
                  setOtp(Array(OTP_LENGTH).fill(''));
                  setError('');
                  setInfo('');
                }}
              >
                ✏️ Change Email
              </button>
            </div>
          </>
        )}

        {/* ── Phase: Success ──────────────────────────────────────────────── */}
        {phase === 'success' && (
          <div className="ev-success">
            <div className="ev-success-icon">
              <CheckCircleIcon />
            </div>
            <div className="ev-verified-badge">
              <span className="ev-badge-dot" />
              Email Verified
            </div>
            <h1 className="page-title" style={{ textAlign: 'center' }}>You're all set!</h1>
            <p className="page-subtitle" style={{ textAlign: 'center' }}>
              Your email <strong>{email}</strong> has been verified successfully.
              Redirecting to your dashboard…
            </p>
            <div className="ev-redirect-bar">
              <div className="ev-redirect-fill" />
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
