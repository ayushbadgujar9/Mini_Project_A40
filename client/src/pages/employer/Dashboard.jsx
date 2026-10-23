import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import PostJobForm from '../../components/PostJobForm';

const API = 'http://localhost:5000';

// ── Skill catalogue — must stay in sync with Job model + CompleteProfile ──────
const SKILLS = [
  { id: 'plumbing',    label: 'Plumbing',    icon: '🔧' },
  { id: 'electrician', label: 'Electrician', icon: '⚡' },
  { id: 'masonry',     label: 'Masonry',     icon: '🧱' },
];

export default function EmployerDashboard() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();

  // ── My posted jobs ─────────────────────────────────────────────────────────
  const [myJobs,      setMyJobs]      = useState([]);
  const [jobsLoading, setJobsLoading] = useState(true);

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

  const openCount     = myJobs.filter((j) => j.status === 'open').length;
  const assignedCount = myJobs.filter((j) => j.status === 'assigned').length;
  const closedCount   = myJobs.filter((j) => j.status === 'closed').length;

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
          <StatCard icon="📢" label="Open Postings"     value={jobsLoading ? '…' : openCount}   color="var(--clr-employer)" />
          <StatCard icon="🤝" label="Assigned (Active)" value={jobsLoading ? '…' : assignedCount} color="#34d399" />
          <StatCard icon="🔒" label="Closed Postings"   value={jobsLoading ? '…' : closedCount} color="var(--clr-admin)" />
          <StatCard icon="📋" label="Total Posted"      value={jobsLoading ? '…' : myJobs.length} color="var(--clr-secondary)" />
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

        <PostJobForm
          token={token}
          onJobCreated={(newJob) => {
            setMyJobs((prev) => [newJob, ...prev]);
            navigate(`/employer/jobs/${newJob._id}/suggested`);
          }}
        />
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
  const skill = SKILLS.find(
    (s) =>
      s.id === job.requiredSkill ||
      (job.requiredSkill === 'plumber' && s.id === 'plumbing') ||
      (job.requiredSkill === 'electrical' && s.id === 'electrician') ||
      (job.requiredSkill === 'masonary' && s.id === 'masonry')
  );
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
          {job.status === 'open' ? '🟢 Open' : job.status === 'assigned' ? '🔒 Assigned' : '🔴 Closed'}
        </span>
        {(job.status === 'open' || job.status === 'assigned') && (
          <button
            id={`view-suggestions-btn-${job._id}`}
            className="btn-suggestions"
            onClick={() => navigate(`/employer/jobs/${job._id}/suggested`)}
          >
            {job.status === 'assigned' ? '🤝 View Assigned Job' : '⚖️ Suggested Workers'}
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
