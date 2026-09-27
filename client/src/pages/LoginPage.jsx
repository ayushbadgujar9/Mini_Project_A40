import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

// ──────────────────────────────────────────────────────────────────────────────
// Icons (inline SVG for zero dependencies)
// ──────────────────────────────────────────────────────────────────────────────
const PhoneIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13 19.79 19.79 0 0 1 1.61 4.4 2 2 0 0 1 3.6 2.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.16 6.16l1.27-.88a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
  </svg>
);

const LockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);

const IdIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
  </svg>
);

// ──────────────────────────────────────────────────────────────────────────────
export default function LoginPage() {
  const navigate = useNavigate();
  const { login, isAuthenticated, user } = useAuth();

  // If already logged in, bounce to dashboard
  if (isAuthenticated) {
    navigate(`/${user.role}/dashboard`, { replace: true });
    return null;
  }

  const [mode, setMode]         = useState('phone'); // 'phone' | 'admin'
  const [phoneNumber, setPhone] = useState('');
  const [adminId, setAdminId]   = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const payload = mode === 'phone'
      ? { phoneNumber: phoneNumber.trim(), password }
      : { adminId: adminId.trim(), password };

    try {
      const { data } = await axios.post('/api/auth/login', payload);
      login(data.token);
      navigate(`/${data.user.role}/dashboard`, { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page">
      <div className="glass-card">
        {/* Brand */}
        <div className="brand">
          <div className="brand-icon">🔗</div>
          <span className="brand-name">FairConnect</span>
        </div>

        {/* Heading */}
        <h1 className="page-title">Welcome back</h1>
        <p className="page-subtitle">Sign in to your account to continue</p>

        {/* Mode Toggle */}
        <div className="tab-group" role="tablist" aria-label="Login mode">
          <button
            id="tab-phone"
            role="tab"
            aria-selected={mode === 'phone'}
            className={`tab-btn ${mode === 'phone' ? 'active' : ''}`}
            onClick={() => { setMode('phone'); setError(''); }}
            type="button"
          >
            📱 Phone Login
          </button>
          <button
            id="tab-admin"
            role="tab"
            aria-selected={mode === 'admin'}
            className={`tab-btn ${mode === 'admin' ? 'active' : ''}`}
            onClick={() => { setMode('admin'); setError(''); }}
            type="button"
          >
            🛡️ Admin Login
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="alert alert-error" role="alert">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate>
          {mode === 'phone' ? (
            <div className="form-group">
              <label className="form-label" htmlFor="login-phone">Phone Number</label>
              <div className="input-wrapper">
                <span className="input-icon"><PhoneIcon /></span>
                <input
                  id="login-phone"
                  type="tel"
                  className="form-input"
                  placeholder="+91 98765 43210"
                  value={phoneNumber}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  autoComplete="tel"
                />
              </div>
            </div>
          ) : (
            <div className="form-group">
              <label className="form-label" htmlFor="login-admin-id">Admin ID</label>
              <div className="input-wrapper">
                <span className="input-icon"><IdIcon /></span>
                <input
                  id="login-admin-id"
                  type="text"
                  className="form-input"
                  placeholder="ADMIN_001"
                  value={adminId}
                  onChange={(e) => setAdminId(e.target.value)}
                  required
                  autoComplete="username"
                />
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="login-password">Password</label>
            <div className="input-wrapper">
              <span className="input-icon"><LockIcon /></span>
              <input
                id="login-password"
                type="password"
                className="form-input"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
          </div>

          <button
            id="login-submit-btn"
            type="submit"
            className="btn-primary"
            disabled={loading}
          >
            {loading && <span className="btn-spinner" />}
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        {/* Footer */}
        <div className="divider">or</div>
        <p className="footer-link">
          Don&apos;t have an account?{' '}
          <Link to="/register">Create one</Link>
        </p>
      </div>
    </main>
  );
}
