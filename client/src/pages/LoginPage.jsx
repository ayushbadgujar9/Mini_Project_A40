import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

// ──────────────────────────────────────────────────────────────────────────────
// Icons
// ──────────────────────────────────────────────────────────────────────────────
const MailIcon = () => (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
  </svg>
);

const UserIcon = () => (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const ArrowLeftIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="m15 18-6-6 6-6" />
  </svg>
);

// ──────────────────────────────────────────────────────────────────────────────
// Pure Email Verification Login & Register Component
// ──────────────────────────────────────────────────────────────────────────────
const ADMIN_EMAILS = [
  'akulkarni.1011@gmail.com',
  'ayushbadgujar9@gmail.com',
  'admin@fairconnect.com',
  'aakulkarni.1011@gmail.com',
];

const isAdminEmail = (e) => ADMIN_EMAILS.includes((e || '').trim().toLowerCase());

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, logout, isAuthenticated, user } = useAuth();

  // Screen state: 'email' (Screen 1) | 'otp' (Screen 2)
  const [screen, setScreen] = useState('email');

  // New user registration mode toggle
  const isRegisterRoute = location.pathname.includes('register');
  const [isNewUserMode, setIsNewUserMode] = useState(isRegisterRoute);

  useEffect(() => {
    setIsNewUserMode(location.pathname.includes('register'));
  }, [location.pathname]);

  // Form Fields
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('worker'); // 'worker' | 'employer'
  const isCurrentEmailAdmin = isAdminEmail(email);
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const digitRefs = useRef([]);

  // Async & UX States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [devOtpCode, setDevOtpCode] = useState(null);
  const [countdown, setCountdown] = useState(300); // 5 minutes
  const [timerActive, setTimerActive] = useState(false);

  // ── Countdown Timer ────────────────────────────────────────────────────────
  useEffect(() => {
    let interval = null;
    if (timerActive && countdown > 0) {
      interval = setInterval(() => setCountdown((c) => c - 1), 1000);
    } else if (countdown === 0) {
      setTimerActive(false);
    }
    return () => clearInterval(interval);
  }, [timerActive, countdown]);

  const formatTimer = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // ── SCREEN 1: Submit Email (Send Verification Code) ────────────────────────
  const handleEmailSubmit = async (e) => {
    if (e) e.preventDefault();
    setError('');
    setSuccess('');

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
      setError('Please provide a valid email address.');
      return;
    }

    setLoading(true);

    try {
      if (isAdminEmail(trimmedEmail)) {
        // Direct Admin Login flow - auto provisions or fetches admin without worker/employer registration
        const { data } = await axios.post('/api/auth/login', {
          email: trimmedEmail,
        });
        setIsNewUserMode(false);
        transitionToOtpScreen(data, trimmedEmail);
        return;
      }

      if (isNewUserMode) {
        // Register Flow: if name is not provided, first check if user already has an existing account
        if (!name.trim()) {
          try {
            const { data } = await axios.post('/api/auth/login', {
              email: trimmedEmail,
            });
            setIsNewUserMode(false);
            transitionToOtpScreen(data, trimmedEmail);
            return;
          } catch (loginErr) {
            if (loginErr.response?.status === 404) {
              setError('Please enter your full name to create your account.');
              setLoading(false);
              return;
            }
            throw loginErr;
          }
        }

        try {
          const { data } = await axios.post('/api/auth/register', {
            name: name.trim(),
            email: trimmedEmail,
            role,
          });

          transitionToOtpScreen(data, trimmedEmail);
        } catch (regErr) {
          if (regErr.response?.status === 409) {
            // Already registered! Seamlessly switch to sign-in and send login OTP
            setIsNewUserMode(false);
            const { data } = await axios.post('/api/auth/login', {
              email: trimmedEmail,
            });
            transitionToOtpScreen(data, trimmedEmail);
            return;
          }
          throw regErr;
        }
      } else {
        // Login Flow
        try {
          const { data } = await axios.post('/api/auth/login', {
            email: trimmedEmail,
          });
          transitionToOtpScreen(data, trimmedEmail);
        } catch (loginErr) {
          if (loginErr.response?.status === 404) {
            // Email not found -> reveal Name & Role fields for instant signup
            setIsNewUserMode(true);
            setSuccess('Welcome! Enter your name and role to complete registration.');
          } else {
            throw loginErr;
          }
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const transitionToOtpScreen = (data, userEmail) => {
    setScreen('otp');
    setCountdown(data.expiresInSeconds || 300);
    setTimerActive(true);
    setSuccess(data.message || `We sent a 6-digit verification code to ${userEmail}`);

    if (data.devOtp) {
      setDevOtpCode(data.devOtp);
      setOtpDigits(data.devOtp.split(''));
    } else {
      setDevOtpCode(null);
      setOtpDigits(['', '', '', '', '', '']);
    }

    setTimeout(() => {
      digitRefs.current[0]?.focus();
    }, 150);
  };

  // ── Resend Code ────────────────────────────────────────────────────────────
  const handleResendOtp = async () => {
    setError('');
    setLoading(true);
    const trimmedEmail = email.trim().toLowerCase();

    try {
      const endpoint = isNewUserMode && name.trim() ? '/api/auth/register' : '/api/auth/login';
      const payload = endpoint === '/api/auth/register'
        ? { name: name.trim(), email: trimmedEmail, role }
        : { email: trimmedEmail };

      const { data } = await axios.post(endpoint, payload);
      setCountdown(data.expiresInSeconds || 300);
      setTimerActive(true);
      setSuccess(`A fresh verification code was sent to ${trimmedEmail}!`);

      if (data.devOtp) {
        setDevOtpCode(data.devOtp);
        setOtpDigits(data.devOtp.split(''));
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to resend code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── OTP Digit Input Handlers ───────────────────────────────────────────────
  const handleDigitChange = (index, value) => {
    const cleanVal = value.replace(/\D/g, '').slice(-1);
    const next = [...otpDigits];
    next[index] = cleanVal;
    setOtpDigits(next);

    if (cleanVal && index < 5) {
      digitRefs.current[index + 1]?.focus();
    }

    const code = next.join('');
    if (code.length === 6) {
      handleVerifyOtp(code);
    }
  };

  const handleDigitKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      digitRefs.current[index - 1]?.focus();
    }
  };

  const handleDigitPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;

    const next = [...otpDigits];
    for (let i = 0; i < pasted.length; i++) {
      next[i] = pasted[i];
    }
    setOtpDigits(next);

    const focusIdx = Math.min(pasted.length, 5);
    digitRefs.current[focusIdx]?.focus();

    if (pasted.length === 6) {
      handleVerifyOtp(pasted);
    }
  };

  // ── SCREEN 2: Verify OTP & Enter ───────────────────────────────────────────
  const handleVerifyOtp = async (codeOverride) => {
    setError('');
    const code = codeOverride || otpDigits.join('');
    if (code.length !== 6) {
      setError('Please enter the complete 6-digit verification code.');
      return;
    }

    setLoading(true);
    try {
      const { data } = await axios.post('/api/auth/verify-otp', {
        email: email.trim().toLowerCase(),
        otp: code,
      });

      setSuccess('Email verified successfully! Entering FairConnect…');
      login(data.token);

      const targetPath = data.user.role === 'admin' ? '/admin/dashboard' : `/${data.user.role}/dashboard`;
      setTimeout(() => {
        navigate(targetPath, { replace: true });
      }, 500);
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid or expired code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      className="auth-page"
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        background: 'linear-gradient(135deg, #f8fafc 0%, #edf2f7 100%)',
      }}
    >
      <div
        className="glass-card"
        style={{
          background: '#ffffff',
          borderRadius: '24px',
          padding: '2.5rem 2.25rem',
          maxWidth: '470px',
          width: '100%',
          boxShadow: '0 20px 45px -10px rgba(15, 23, 42, 0.1), 0 0 1px 1px rgba(15, 23, 42, 0.05)',
          border: '1px solid #e2e8f0',
        }}
      >
        {/* Brand Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginBottom: '1.75rem' }}>
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '13px',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              fontSize: '1.35rem',
              boxShadow: '0 8px 18px rgba(16, 185, 129, 0.28)',
            }}
          >
            🔗
          </div>
          <div>
            <span style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.3px', display: 'block', lineHeight: 1.2 }}>
              FairConnect
            </span>
            <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>
              Email Verification Sign-In
            </span>
          </div>
        </div>

        {/* Active Session Notification */}
        {isAuthenticated && user && (
          <div
            style={{
              background: '#f0fdf4',
              border: '1.5px solid #86efac',
              borderRadius: '14px',
              padding: '0.85rem 1rem',
              marginBottom: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.75rem',
            }}
          >
            <div>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#166534' }}>
                Active Session
              </div>
              <div style={{ fontSize: '0.78rem', color: '#15803d' }}>
                Signed in as <strong>{user.name || user.email}</strong> ({user.role})
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button
                type="button"
                onClick={() => navigate(`/${user.role}/dashboard`)}
                style={{
                  background: '#15803d',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.35rem 0.65rem',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Dashboard →
              </button>
              <button
                type="button"
                onClick={() => logout()}
                style={{
                  background: '#fef2f2',
                  color: '#b91c1c',
                  border: '1px solid #fecaca',
                  borderRadius: '8px',
                  padding: '0.35rem 0.65rem',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Sign Out
              </button>
            </div>
          </div>
        )}

        {/* Global Error Banner */}
        {error && (
          <div
            role="alert"
            style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#b91c1c',
              borderRadius: '12px',
              padding: '0.75rem 1rem',
              fontSize: '0.875rem',
              marginBottom: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Global Success Banner */}
        {success && (
          <div
            role="status"
            style={{
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              color: '#15803d',
              borderRadius: '12px',
              padding: '0.75rem 1rem',
              fontSize: '0.875rem',
              marginBottom: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <span>✅</span>
            <span>{success}</span>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            SCREEN 1: EMAIL ADDRESS ENTRY & REGISTRATION
        ══════════════════════════════════════════════════════════════════ */}
        {screen === 'email' && (
          <div>
            <div style={{ marginBottom: '1.5rem' }}>
              <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.4rem', letterSpacing: '-0.4px' }}>
                {isNewUserMode ? 'Create your account' : 'Sign in with Email'}
              </h1>
              <p style={{ fontSize: '0.9rem', color: '#64748b', margin: 0, lineHeight: 1.5 }}>
                {isNewUserMode
                  ? 'Enter your email to receive an instant verification code and get started.'
                  : 'Enter your email address to receive a secure, passwordless login code.'}
              </p>
            </div>

            <form onSubmit={handleEmailSubmit} noValidate>
              {/* Email Input */}
              <div style={{ marginBottom: '1.15rem' }}>
                <label
                  htmlFor="user-email-input"
                  style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}
                >
                  Email Address
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <span style={{ position: 'absolute', left: '14px', color: '#94a3b8', display: 'flex' }}>
                    <MailIcon />
                  </span>
                  <input
                    id="user-email-input"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. employer@apexconstructions.com"
                    autoFocus
                    autoComplete="email"
                    required
                    style={{
                      width: '100%',
                      padding: '0.8rem 1rem 0.8rem 2.65rem',
                      borderRadius: '12px',
                      border: '1.5px solid #cbd5e1',
                      fontSize: '0.95rem',
                      color: '#0f172a',
                      background: '#ffffff',
                      outline: 'none',
                      transition: 'border-color 0.2s, box-shadow 0.2s',
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#10b981';
                      e.target.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.15)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#cbd5e1';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                </div>
                {isCurrentEmailAdmin && (
                  <div
                    style={{
                      marginTop: '0.5rem',
                      background: '#f0fdf4',
                      border: '1.5px solid #86efac',
                      borderRadius: '10px',
                      padding: '0.55rem 0.85rem',
                      fontSize: '0.82rem',
                      color: '#15803d',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      fontWeight: 600,
                    }}
                  >
                    <span>🛡️</span>
                    <span>Recognized Admin Account — Direct access to the FairConnect Admin Portal.</span>
                  </div>
                )}
              </div>

              {/* Registration Extra Fields (Name & Role) */}
              {isNewUserMode && !isCurrentEmailAdmin && (
                <div
                  style={{
                    background: '#f8fafc',
                    border: '1.5px solid #e2e8f0',
                    borderRadius: '16px',
                    padding: '1.25rem',
                    marginBottom: '1.25rem',
                  }}
                >
                  {/* Full Name */}
                  <div style={{ marginBottom: '1rem' }}>
                    <label
                      htmlFor="user-name-input"
                      style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}
                    >
                      Full Name
                    </label>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <span style={{ position: 'absolute', left: '12px', color: '#94a3b8', display: 'flex' }}>
                        <UserIcon />
                      </span>
                      <input
                        id="user-name-input"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Ramesh Patil"
                        autoComplete="name"
                        required
                        style={{
                          width: '100%',
                          padding: '0.7rem 0.85rem 0.7rem 2.45rem',
                          borderRadius: '10px',
                          border: '1.5px solid #cbd5e1',
                          fontSize: '0.92rem',
                          color: '#0f172a',
                          background: '#ffffff',
                          outline: 'none',
                        }}
                      />
                    </div>
                  </div>

                  {/* Role Choice */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>
                      Join as:
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                      <button
                        type="button"
                        id="role-worker-choice"
                        onClick={() => setRole('worker')}
                        style={{
                          padding: '0.75rem 0.5rem',
                          borderRadius: '12px',
                          border: role === 'worker' ? '2px solid #10b981' : '1.5px solid #cbd5e1',
                          background: role === 'worker' ? '#f0fdf4' : '#ffffff',
                          cursor: 'pointer',
                          textAlign: 'center',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div style={{ fontSize: '1.35rem', marginBottom: '0.2rem' }}>👷</div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: role === 'worker' ? '#047857' : '#334155' }}>
                          Worker
                        </div>
                      </button>

                      <button
                        type="button"
                        id="role-employer-choice"
                        onClick={() => setRole('employer')}
                        style={{
                          padding: '0.75rem 0.5rem',
                          borderRadius: '12px',
                          border: role === 'employer' ? '2px solid #d97706' : '1.5px solid #cbd5e1',
                          background: role === 'employer' ? '#fffbeb' : '#ffffff',
                          cursor: 'pointer',
                          textAlign: 'center',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div style={{ fontSize: '1.35rem', marginBottom: '0.2rem' }}>🏢</div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: role === 'employer' ? '#b45309' : '#334155' }}>
                          Employer
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <button
                id="submit-email-btn"
                type="submit"
                disabled={loading || !email.trim()}
                style={{
                  width: '100%',
                  padding: '0.9rem 1.25rem',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: '#ffffff',
                  fontSize: '1rem',
                  fontWeight: 700,
                  border: 'none',
                  cursor: loading || !email.trim() ? 'not-allowed' : 'pointer',
                  opacity: loading || !email.trim() ? 0.65 : 1,
                  boxShadow: '0 8px 20px -3px rgba(16, 185, 129, 0.35)',
                  transition: 'transform 0.15s, box-shadow 0.15s',
                }}
              >
                {loading ? 'Sending Code…' : isCurrentEmailAdmin ? 'Access Admin Portal →' : isNewUserMode ? 'Send Verification Code →' : 'Continue with Email OTP →'}
              </button>
            </form>

            {/* Toggle Sign in / Register */}
            <div style={{ marginTop: '1.5rem', textAlign: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '1.25rem' }}>
              {isNewUserMode ? (
                <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748b' }}>
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setIsNewUserMode(false);
                      setError('');
                      navigate('/login', { replace: true });
                    }}
                    style={{ background: 'none', border: 'none', color: '#10b981', fontWeight: 700, cursor: 'pointer', padding: 0 }}
                  >
                    Sign in with email
                  </button>
                </p>
              ) : (
                <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748b' }}>
                  New to FairConnect?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setIsNewUserMode(true);
                      setError('');
                      navigate('/register', { replace: true });
                    }}
                    style={{ background: 'none', border: 'none', color: '#10b981', fontWeight: 700, cursor: 'pointer', padding: 0 }}
                  >
                    Create an account
                  </button>
                </p>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            SCREEN 2: 6-DIGIT EMAIL VERIFICATION CODE ENTRY
        ══════════════════════════════════════════════════════════════════ */}
        {screen === 'otp' && (
          <div>
            {/* Back Button */}
            <button
              type="button"
              id="back-to-email-btn"
              onClick={() => {
                setScreen('email');
                setError('');
                setSuccess('');
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                background: 'none',
                border: 'none',
                color: '#64748b',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                padding: 0,
                marginBottom: '1rem',
              }}
            >
              <ArrowLeftIcon />
              Change email
            </button>

            <div style={{ marginBottom: '1.25rem' }}>
              <h1 style={{ fontSize: '1.55rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.35rem', letterSpacing: '-0.4px' }}>
                Verify Your Email
              </h1>
              <p style={{ fontSize: '1rem', fontWeight: 700, color: '#10b981', margin: '0 0 0.25rem', wordBreak: 'break-all' }}>
                {email}
              </p>
              <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0, lineHeight: 1.5 }}>
                Enter the 6-digit verification code sent to your email.
              </p>
            </div>

            {/* Dev Fallback Code Banner */}
            {devOtpCode && (
              <div
                style={{
                  background: '#ecfdf5',
                  border: '1.5px solid #a7f3d0',
                  borderRadius: '14px',
                  padding: '0.85rem 1rem',
                  marginBottom: '1.25rem',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#047857', marginBottom: '0.2rem' }}>
                  🔑 Verification Code:
                </div>
                <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#065f46', letterSpacing: '6px' }}>
                  {devOtpCode}
                </div>
                <button
                  type="button"
                  id="auto-fill-otp-btn"
                  onClick={() => {
                    setOtpDigits(devOtpCode.split(''));
                    handleVerifyOtp(devOtpCode);
                  }}
                  style={{
                    marginTop: '0.45rem',
                    background: '#059669',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '0.35rem 0.85rem',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  ⚡ Auto-fill & Verify →
                </button>
              </div>
            )}

            {/* 6-Digit Fat-Finger Code Inputs */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div
                style={{
                  display: 'flex',
                  gap: '0.5rem',
                  justifyContent: 'center',
                }}
                onPaste={handleDigitPaste}
              >
                {otpDigits.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => (digitRefs.current[idx] = el)}
                    id={`otp-box-${idx}`}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleDigitChange(idx, e.target.value)}
                    onKeyDown={(e) => handleDigitKeyDown(idx, e)}
                    style={{
                      width: '48px',
                      height: '58px',
                      borderRadius: '12px',
                      border: digit ? '2px solid #10b981' : '2px solid #cbd5e1',
                      background: digit ? '#f0fdf4' : '#ffffff',
                      textAlign: 'center',
                      fontSize: '1.65rem',
                      fontWeight: 800,
                      color: '#0f172a',
                      outline: 'none',
                      transition: 'border-color 0.15s, box-shadow 0.15s',
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#10b981';
                      e.target.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.18)';
                    }}
                    onBlur={(e) => {
                      if (!digit) e.target.style.borderColor = '#cbd5e1';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Countdown Timer */}
            <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
              {timerActive ? (
                <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                  Code valid for:{' '}
                  <strong style={{ color: countdown < 60 ? '#e11d48' : '#059669', fontWeight: 700 }}>
                    {formatTimer(countdown)}
                  </strong>
                </div>
              ) : (
                <div style={{ fontSize: '0.85rem', color: '#e11d48', fontWeight: 600 }}>
                  Code expired. Please request a new code.
                </div>
              )}
            </div>

            {/* Verify & Enter Button */}
            <button
              id="verify-enter-btn"
              type="button"
              onClick={() => handleVerifyOtp()}
              disabled={loading || otpDigits.join('').length !== 6}
              style={{
                width: '100%',
                padding: '0.9rem 1.25rem',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: '#ffffff',
                fontSize: '1rem',
                fontWeight: 800,
                border: 'none',
                cursor: loading || otpDigits.join('').length !== 6 ? 'not-allowed' : 'pointer',
                opacity: loading || otpDigits.join('').length !== 6 ? 0.6 : 1,
                boxShadow: '0 8px 22px -3px rgba(16, 185, 129, 0.4)',
                marginBottom: '1rem',
              }}
            >
              {loading ? 'Verifying Code…' : 'Verify & Enter FairConnect →'}
            </button>

            {/* Resend Link */}
            <div style={{ textAlign: 'center' }}>
              <button
                type="button"
                id="resend-otp-btn"
                onClick={handleResendOtp}
                disabled={loading || (timerActive && countdown > 240)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: timerActive && countdown > 240 ? '#94a3b8' : '#0284c7',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: timerActive && countdown > 240 ? 'not-allowed' : 'pointer',
                }}
              >
                Didn&apos;t receive code? Resend OTP
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
