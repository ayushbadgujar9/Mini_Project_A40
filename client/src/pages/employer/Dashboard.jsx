import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import PostJobForm from '../../components/PostJobForm';
import ContactCard from '../../components/ContactCard';
import ChatDrawer, { ChatButton, useChatUnreadCounts } from '../../components/ChatDrawer';
import StarRatingModal from '../../components/StarRatingModal';

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

  // ── Chat drawer ────────────────────────────────────────────────
  const [chatDrawer, setChatDrawer] = useState(null);
  const unreadCounts = useChatUnreadCounts(token);

  // ── Rating Modal ───────────────────────────────────────────────
  const [ratingModal, setRatingModal] = useState(null);

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
          }}
        />
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          SECTION — MY POSTED JOBS
      ══════════════════════════════════════════════════════════════════ */}
      <div className="posted-jobs-section">
        <div className="section-header">
          <div className="section-icon">📋</div>
          <div>
            <div className="section-title">My Job Postings</div>
            <div className="section-subtitle">
              {jobsLoading ? 'Loading…' : `${myJobs.length} job${myJobs.length !== 1 ? 's' : ''} posted`}
            </div>
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
              <EmployerJobRow
                key={job._id}
                job={job}
                token={token}
                unreadCount={job.acceptedApplication ? (unreadCounts[job.acceptedApplication._id] || 0) : 0}
                onOpenChat={job.acceptedApplication ? () => setChatDrawer({
                  applicationId: job.acceptedApplication._id,
                  otherPartyName: job.acceptedApplication.worker?.name || 'Worker',
                  isReadOnly: job.status === 'closed',
                }) : null}
                onRateWorker={(workerData) => setRatingModal(workerData)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Star Rating Modal ── */}
      {ratingModal && (
        <StarRatingModal
          isOpen={!!ratingModal}
          onClose={() => setRatingModal(null)}
          workerId={ratingModal.workerId}
          workerName={ratingModal.workerName}
          jobId={ratingModal.jobId}
          jobTitle={ratingModal.jobTitle}
          onSuccess={() => fetchMyJobs()}
        />
      )}

      {/* ── Chat Drawer ── */}
      {chatDrawer && (
        <ChatDrawer
          open={!!chatDrawer}
          onClose={() => setChatDrawer(null)}
          applicationId={chatDrawer.applicationId}
          token={token}
          myUserId={user?.id}
          otherPartyName={chatDrawer.otherPartyName}
          isReadOnly={chatDrawer.isReadOnly}
        />
      )}
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

// ── EmployerJobRow ────────────────────────────────────────────────────────────
function EmployerJobRow({ job, token, unreadCount = 0, onOpenChat, onRateWorker }) {
  const navigate = useNavigate();
  const [showContact, setShowContact] = useState(false);
  const skill = SKILLS.find(
    (s) =>
      s.id === job.requiredSkill ||
      (job.requiredSkill === 'plumber' && s.id === 'plumbing') ||
      (job.requiredSkill === 'electrical' && s.id === 'electrician') ||
      (job.requiredSkill === 'masonary' && s.id === 'masonry')
  );

  const hasAccepted = !!job.acceptedApplication;

  return (
    <div className="employer-job-row" style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '0.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <div className="ejr-left">
          <div className="ejr-title">{job.title}</div>
          <div className="ejr-meta">
            {skill && <span className="skill-pill">{skill.icon} {skill.label}</span>}
            <span className="wage-badge">₹{job.dailyWage}/day</span>
            {job.city && <span className="sw-city-tag">📍 {job.city}</span>}
            {hasAccepted && job.acceptedApplication.worker?.name && (
              <span style={{ fontSize: '0.82rem', color: '#059669', fontWeight: 700, background: 'rgba(16,185,129,0.1)', padding: '0.15rem 0.5rem', borderRadius: '6px' }}>
                👷 {job.acceptedApplication.worker.name}
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span className={`job-status-badge ${job.status}`}>
            {job.status === 'open' ? '🟢 Open' : job.status === 'assigned' ? '🔒 Assigned' : '🔴 Closed'}
          </span>

          {hasAccepted && onOpenChat && (
            <ChatButton
              applicationId={job.acceptedApplication._id}
              unreadCount={unreadCount}
              onClick={onOpenChat}
              label="💬 Chat with Worker"
            />
          )}

          {hasAccepted && (
            <button
              id={`toggle-contact-btn-${job._id}`}
              style={{
                padding: '0.45rem 0.85rem',
                borderRadius: 10,
                border: '1px solid #cbd5e1',
                background: showContact ? '#e2e8f0' : '#ffffff',
                color: '#334155',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
              onClick={() => setShowContact(!showContact)}
            >
              {showContact ? 'Hide Contact' : '👤 Contact Info'}
            </button>
          )}

          {hasAccepted && (
            <button
              id={`rate-worker-btn-${job._id}`}
              className="btn-suggestions"
              style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', color: '#fff', border: 'none' }}
              onClick={() => onRateWorker && onRateWorker({
                workerId: job.acceptedApplication.worker?._id || job.acceptedApplication.worker,
                workerName: job.acceptedApplication.worker?.name || 'Worker',
                jobId: job._id,
                jobTitle: job.title,
              })}
            >
              ⭐ Rate Worker
            </button>
          )}

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

      {showContact && hasAccepted && (
        <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px dashed #cbd5e1' }}>
          <ContactCard applicationId={job.acceptedApplication._id} token={token} />
        </div>
      )}
    </div>
  );
}
