import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

// ──────────────────────────────────────────────────────────────────────────────
// Inline SVG icons
// ──────────────────────────────────────────────────────────────────────────────
const UserIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
);

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

// ──────────────────────────────────────────────────────────────────────────────
export default function RegisterPage() {
  const navigate = useNavigate();
  const { login, isAuthenticated, user } = useAuth();

  if (isAuthenticated) {
    navigate(`/${user.role}/dashboard`, { replace: true });
    return null;
  }

  const [role, setRole]             = useState('worker');
  const [name, setName]             = useState('');
  const [phoneNumber, setPhone]     = useState('');
  const [password, setPassword]     = useState('');
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  const [success, setSuccess]       = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const { data } = await axios.post('/api/auth/register', {
        name: name.trim(),
        role,
        phoneNumber: phoneNumber.trim(),
        password,
      });
      setSuccess('Account created! Redirecting…');
      login(data.token);
      setTimeout(() => navigate(`/${data.user.role}/dashboard`, { replace: true }), 800);
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
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

        <h1 className="page-title">Create account</h1>
        <p className="page-subtitle">Join thousands of workers and employers</p>

        {/* Role selector */}
        <div className="role-cards">
          <button
            type="button"
            id="role-worker-btn"
            className={`role-card ${role === 'worker' ? 'selected-worker' : ''}`}
            onClick={() => setRole('worker')}
            aria-pressed={role === 'worker'}
          >
            <div className="role-card-icon">👷</div>
            <div className="role-card-label">Worker</div>
          </button>
          <button
            type="button"
            id="role-employer-btn"
            className={`role-card ${role === 'employer' ? 'selected-employer' : ''}`}
            onClick={() => setRole('employer')}
            aria-pressed={role === 'employer'}
          >
            <div className="role-card-icon">🏢</div>
            <div className="role-card-label">Employer</div>
          </button>
        </div>

        {/* Alerts */}
        {error   && <div className="alert alert-error"   role="alert"><span>⚠️</span><span>{error}</span></div>}
        {success && <div className="alert alert-success" role="status"><span>✅</span><span>{success}</span></div>}

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label className="form-label" htmlFor="reg-name">Full Name</label>
            <div className="input-wrapper">
              <span className="input-icon"><UserIcon /></span>
              <input
                id="reg-name"
                type="text"
                className="form-input"
                placeholder="Ravi Kumar"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="reg-phone">Phone Number</label>
            <div className="input-wrapper">
              <span className="input-icon"><PhoneIcon /></span>
              <input
                id="reg-phone"
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

          <div className="form-group">
            <label className="form-label" htmlFor="reg-password">Password</label>
            <div className="input-wrapper">
              <span className="input-icon"><LockIcon /></span>
              <input
                id="reg-password"
                type="password"
                className="form-input"
                placeholder="Minimum 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>
          </div>

          <button
            id="register-submit-btn"
            type="submit"
            className="btn-primary"
            disabled={loading}
          >
            {loading && <span className="btn-spinner" />}
            {loading ? 'Creating account…' : `Register as ${role.charAt(0).toUpperCase() + role.slice(1)}`}
          </button>
        </form>

        <div className="divider">or</div>
        <p className="footer-link">
          Already have an account?{' '}
          <Link to="/login">Sign in</Link>
        </p>
      </div>
    </main>
  );
}
