import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const API = 'http://localhost:5000';

// ── Skill catalogue — must stay in sync with Job model + CompleteProfile ──────
const SKILLS = [
  { id: 'plumbing',    label: 'Plumbing',    icon: '🔧' },
  { id: 'electrician', label: 'Electrician', icon: '⚡' },
  { id: 'masonry',     label: 'Masonry',     icon: '🧱' },
];

const EMPTY_FORM = { title: '', description: '', requiredSkill: '', dailyWage: '', city: '' };

export default function EmployerDashboard() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();

  // ── My posted jobs ─────────────────────────────────────────────────────────
  const [myJobs,      setMyJobs]      = useState([]);
  const [jobsLoading, setJobsLoading] = useState(true);

  // ── Post-job form ──────────────────────────────────────────────────────────
  const [form,        setForm]        = useState(EMPTY_FORM);
  const [submitting,  setSubmitting]  = useState(false);
  const [formMsg,     setFormMsg]     = useState(null); // { type, text }

  // ── Fetch employer's own jobs ──────────────────────────────────────────────
  const fetchMyJobs = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API}/api/jobs?mine=true`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setMyJobs(data.jobs || []);
    } catch {
      setMyJobs([]);
    } finally {
      setJobsLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchMyJobs(); }, [fetchMyJobs]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleLogout = () => { logout(); navigate('/login', { replace: true }); };

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setFormMsg(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { title, description, requiredSkill, dailyWage, city } = form;
    if (!title.trim() || !description.trim() || !requiredSkill || !dailyWage) {
      setFormMsg({ type: 'error', text: 'Please fill in all fields.' });
      return;
    }
    if (Number(dailyWage) < 1) {
      setFormMsg({ type: 'error', text: 'Daily wage must be at least ₹1.' });
      return;
    }
    setSubmitting(true);
    setFormMsg(null);
    try {
      const res = await fetch(`${API}/api/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          requiredSkill,
          dailyWage: Number(dailyWage),
          city: city.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setForm(EMPTY_FORM);
      setMyJobs((prev) => [data.job, ...prev]);
      // → Navigate directly to the Suggested Workers screen
      navigate(`/employer/jobs/${data.job._id}/suggested`);
    } catch (err) {
      setFormMsg({ type: 'error', text: err.message || 'Failed to post job.' });
      setSubmitting(false);
    }
  };

  const openCount   = myJobs.filter((j) => j.status === 'open').length;
  const closedCount = myJobs.filter((j) => j.status === 'closed').length;
  const descLen     = form.description.length;

  return (
    <div className="dashboard-page">

      {/* ── Header ── */}
      <header className="dashboard-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div className="brand-icon" style={{ width: 36, height: 36, fontSize: '1rem' }}>🔗</div>
          <span className="dashboard-title">FairConnect</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span className="role-badge employer">Employer</span>
          <button id="employer-logout-btn" className="btn-logout" onClick={handleLogout}>Sign Out</button>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="dashboard-hero" style={{ marginBottom: '2rem' }}>
        <div className="dashboard-hero-icon">🏢</div>
        <h1>Welcome, {user?.name || 'Employer'}!</h1>
        <p>
          You&apos;re logged in as an <strong>Employer</strong>. Post jobs, browse worker
          profiles, and build your team with FairConnect&apos;s informal workforce.
        </p>
        <div style={{ marginTop: '2rem', display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <StatCard icon="📢" label="Active Postings"  value={jobsLoading ? '…' : openCount}   color="var(--clr-employer)" />
          <StatCard icon="🔒" label="Closed Postings"  value={jobsLoading ? '…' : closedCount} color="var(--clr-admin)" />
          <StatCard icon="📋" label="Total Posted"     value={jobsLoading ? '…' : myJobs.length} color="var(--clr-secondary)" />
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          SECTION — POST A JOB
      ══════════════════════════════════════════════════════════════════ */}
      <div className="job-form-section">
        <div className="section-header">
          <div className="section-icon">📢</div>
          <div>
            <div className="section-title">Post a New Job</div>
            <div className="section-subtitle">Fill in the details — workers will see it immediately</div>
          </div>
        </div>

        <form id="post-job-form" className="post-job-form" onSubmit={handleSubmit} noValidate>
          {/* Row 1: Title + Skill */}
          <div className="pjf-row">
            <div className="form-group" style={{ flex: 2 }}>
              <label className="form-label" htmlFor="job-title">Job Title</label>
              <div className="input-wrapper">
                <span className="input-icon">💼</span>
                <input
                  id="job-title"
                  name="title"
                  type="text"
                  className="form-input"
                  placeholder="e.g. Site Helper Needed"
                  maxLength={100}
                  value={form.title}
                  onChange={handleChange}
                  disabled={submitting}
                />
              </div>
            </div>

            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label" htmlFor="job-skill">Required Skill</label>
              <div className="input-wrapper">
                <span className="input-icon">🛠️</span>
                <select
                  id="job-skill"
                  name="requiredSkill"
                  className="form-select"
                  value={form.requiredSkill}
                  onChange={handleChange}
                  disabled={submitting}
                >
                  <option value="" disabled>Select a skill…</option>
                  {SKILLS.map((s) => (
                    <option key={s.id} value={s.id}>{s.icon} {s.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label" htmlFor="job-city">Job City / Location</label>
              <div className="input-wrapper">
                <span className="input-icon">📍</span>
                <input
                  id="job-city"
                  name="city"
                  type="text"
                  className="form-input"
                  placeholder="e.g. Mumbai"
                  maxLength={60}
                  value={form.city}
                  onChange={handleChange}
                  disabled={submitting}
                />
              </div>
            </div>
          </div>

          {/* Row 2: Description */}
          <div className="form-group">
            <label className="form-label" htmlFor="job-description">
              Description
              <span style={{ float: 'right', fontWeight: 400, color: descLen > 900 ? '#f43f5e' : '#475569' }}>
                {descLen}/1000
              </span>
            </label>
            <textarea
              id="job-description"
              name="description"
              className="form-input pjf-textarea"
              placeholder="Describe the job, working hours, location, requirements…"
              maxLength={1000}
              rows={4}
              value={form.description}
              onChange={handleChange}
              disabled={submitting}
            />
          </div>

          {/* Row 3: Wage + Submit */}
          <div className="pjf-row pjf-row-bottom">
            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
              <label className="form-label" htmlFor="job-wage">Daily Wage (₹)</label>
              <div className="input-wrapper">
                <span className="input-icon">💰</span>
                <input
                  id="job-wage"
                  name="dailyWage"
                  type="number"
                  className="form-input"
                  placeholder="e.g. 800"
                  min={1}
                  value={form.dailyWage}
                  onChange={handleChange}
                  disabled={submitting}
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '0' }}>
              <button
                id="submit-job-btn"
                type="submit"
                className="btn-primary pjf-submit-btn"
                disabled={submitting}
              >
                {submitting
                  ? <><span className="btn-spinner" />Posting…</>
                  : '📢 Post Job →'}
              </button>
            </div>
          </div>

          {/* Alert */}
          {formMsg && (
            <div className={`alert ${formMsg.type === 'error' ? 'alert-error' : 'alert-success'}`}
                 style={{ marginTop: '1rem', marginBottom: 0 }}>
              <span>{formMsg.type === 'error' ? '⚠️' : '✅'}</span>
              {formMsg.text}
            </div>
          )}
        </form>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          SECTION — MY POSTED JOBS
      ══════════════════════════════════════════════════════════════════ */}
      <div className="job-form-section" style={{ marginTop: '1.5rem' }}>
        <div className="section-header">
          <div className="section-icon">📋</div>
          <div>
            <div className="section-title">My Posted Jobs</div>
            <div className="section-subtitle">All jobs you have listed on FairConnect</div>
          </div>
        </div>

        {jobsLoading ? (
          <div className="jobs-shimmer-list">
            {[1, 2].map((n) => <div key={n} className="shimmer-card" />)}
          </div>
        ) : myJobs.length === 0 ? (
          <div className="jobs-empty">
            <div className="jobs-empty-icon">📭</div>
            <p>No jobs posted yet. Use the form above to get started!</p>
          </div>
        ) : (
          <div className="employer-jobs-list">
            {myJobs.map((job) => (
              <EmployerJobRow key={job._id} job={job} />
            ))}
          </div>
        )}
      </div>

    </div>
  );
}

// ── StatCard ──────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, color }) {
  return (
    <div style={{
      padding: '1.25rem 1.75rem',
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '16px',
      textAlign: 'center',
      minWidth: '130px',
    }}>
      <div style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>{icon}</div>
      <div style={{ fontSize: '1.5rem', fontWeight: 800, color, fontFamily: 'var(--font-display)' }}>{value}</div>
      <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: '0.25rem' }}>{label}</div>
    </div>
  );
}

// ── EmployerJobRow ───────────────────────────────────────────────────────────────────────────────
function EmployerJobRow({ job }) {
  const navigate = useNavigate();
  const skill = SKILLS.find((s) => s.id === job.requiredSkill);
  return (
    <div className="employer-job-row">
      <div className="ejr-left">
        <div className="ejr-title">{job.title}</div>
        <div className="ejr-meta">
          {skill && <span className="skill-pill">{skill.icon} {skill.label}</span>}
          <span className="wage-badge">₹{job.dailyWage}/day</span>
          {job.city && <span className="sw-city-tag">📍 {job.city}</span>}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span className={`job-status-badge ${job.status}`}>
          {job.status === 'open' ? '🟢 Open' : '🔴 Closed'}
        </span>
        {job.status === 'open' && (
          <button
            id={`view-suggestions-btn-${job._id}`}
            className="btn-suggestions"
            onClick={() => navigate(`/employer/jobs/${job._id}/suggested`)}
          >
            ⚖️ Suggested Workers
          </button>
        )}
        {job.status === 'closed' && (
          <button
            id={`view-result-btn-${job._id}`}
            className="btn-view-result"
            onClick={() => navigate(`/employer/jobs/${job._id}/suggested`)}
          >
            🏆 View Result
          </button>
        )}
      </div>
    </div>
  );
}
