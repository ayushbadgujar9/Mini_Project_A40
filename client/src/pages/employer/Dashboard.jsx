import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import PostJobForm from '../../components/PostJobForm';
import ContactCard from '../../components/ContactCard';
import ChatDrawer, { ChatButton, useChatUnreadCounts } from '../../components/ChatDrawer';
import StarRatingModal from '../../components/StarRatingModal';
import { Modal } from '../../components/ui/Overlay';
import DropdownMenu from '../../components/ui/DropdownMenu';
import SegmentedTabs from '../../components/ui/SegmentedTabs';
import StatChip from '../../components/ui/StatChip';

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

  // ── Post job modal ─────────────────────────────────────────────────────────
  const [showPostForm, setShowPostForm] = useState(false);

  // ── Job status filter ──────────────────────────────────────────────────────
  const [jobFilter, setJobFilter] = useState('all'); // 'all' | 'open' | 'assigned' | 'closed'

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

  // Derived visible jobs
  const visibleJobs = myJobs.filter((j) => {
    if (jobFilter === 'all') return true;
    return j.status === jobFilter;
  });

  // ── Chat drawer ────────────────────────────────────────────────
  const [chatDrawer, setChatDrawer] = useState(null);
  const unreadCounts = useChatUnreadCounts(token);

  // ── Rating Modal ───────────────────────────────────────────────
  const [ratingModal, setRatingModal] = useState(null);

  // First name
  const fullName = user?.name || '';
  const firstName = fullName.split(' ')[0] || '';
  const greeting = firstName ? `Welcome back, ${firstName}` : 'Welcome back';

  // Avatar initial
  const avatarInitial = (firstName[0] || 'E').toUpperCase();

  // Tab definitions for job status filter
  const jobStatusTabs = [
    { id: 'all',      label: 'All',      count: myJobs.length },
    { id: 'open',     label: 'Open',     count: openCount },
    { id: 'assigned', label: 'Assigned', count: assignedCount },
    { id: 'closed',   label: 'Closed',   count: closedCount },
  ];

  return (
    <div className="fc-page">

      {/* ── Top bar ── */}
      <header className="fc-topbar">
        <div className="fc-brand">
          <div className="brand-icon" style={{ width: 32, height: 32, fontSize: '0.9rem' }}>🔗</div>
          FairConnect
          <span className="role-badge employer fc-hide-sm" style={{ marginLeft: '0.5rem' }}>Customer</span>
        </div>
        <div className="fc-topbar-right">
          <button
            id="open-post-job-btn"
            className="fc-btn fc-btn--primary"
            onClick={() => setShowPostForm(true)}
          >
            ＋ Post a job
          </button>
          <DropdownMenu
            label="Customer account menu"
            align="right"
            trigger={<div className="fc-avatar">{avatarInitial}</div>}
            items={[
              { label: 'Post a job', icon: '📢', onClick: () => setShowPostForm(true) },
              { label: 'Sign Out',   icon: '🚪', danger: true, onClick: handleLogout },
            ]}
          />
        </div>
      </header>

      {/* ── Greeting ── */}
      <div className="fc-greeting" style={{ marginBottom: '1rem' }}>
        <div>
          <h1>{greeting}</h1>
          <p style={{ fontSize: '0.88rem', color: 'var(--clr-text-muted)', marginTop: '0.25rem' }}>
            Post jobs, browse worker profiles, and build your team.
          </p>
        </div>

        {/* KPI chips */}
        <div className="fc-kpis cols-4" style={{ flexShrink: 0 }}>
          <StatChip
            icon="📢" label="Open" value={jobsLoading ? '…' : openCount}
            tone="green" onClick={() => setJobFilter('open')}
          />
          <StatChip
            icon="🤝" label="Assigned" value={jobsLoading ? '…' : assignedCount}
            tone="amber" onClick={() => setJobFilter('assigned')}
          />
          <StatChip
            icon="🔒" label="Closed" value={jobsLoading ? '…' : closedCount}
            tone="rose" onClick={() => setJobFilter('closed')}
          />
          <StatChip
            icon="📋" label="Total" value={jobsLoading ? '…' : myJobs.length}
            tone="indigo" onClick={() => setJobFilter('all')}
          />
        </div>
      </div>

      {/* ── In-progress alert ── */}
      {assignedCount > 0 && (
        <div className="fc-alerts">
          <div className="fc-alert fc-alert--info">
            <span>
              🤝 <strong>{assignedCount}</strong> job{assignedCount !== 1 ? 's' : ''} in progress: mark the job complete after the work is done so the worker is credited.
            </span>
            <button
              className="fc-btn fc-btn--ghost fc-btn--sm"
              onClick={() => setJobFilter('assigned')}
            >
              Review →
            </button>
          </div>
        </div>
      )}

      {/* ── My job postings section ── */}
      <div>
        <div className="fc-section-head">
          <h2>My job postings</h2>
          <span>
            {jobsLoading ? 'Loading…' : `${visibleJobs.length} of ${myJobs.length} job${myJobs.length !== 1 ? 's' : ''}`}
          </span>
        </div>

        {/* Status filter tabs */}
        <SegmentedTabs
          tabs={jobStatusTabs}
          value={jobFilter}
          onChange={setJobFilter}
          ariaLabel="Filter jobs by status"
        />

        {/* Job list */}
        {jobsLoading ? (
          <div className="fc-job-list">
            {[1, 2].map((n) => <div key={n} className="shimmer-card" style={{ height: 80 }} />)}
          </div>
        ) : visibleJobs.length === 0 ? (
          <div className="fc-empty">
            <div className="fc-empty-icon">📭</div>
            <p style={{ marginBottom: '1rem' }}>
              {jobFilter === 'all'
                ? 'No jobs posted yet.'
                : `No ${jobFilter} jobs.`}
            </p>
            {jobFilter === 'all' && (
              <button
                className="fc-btn fc-btn--primary"
                onClick={() => setShowPostForm(true)}
              >
                ＋ Post your first job
              </button>
            )}
            {jobFilter !== 'all' && (
              <button
                className="fc-btn fc-btn--ghost fc-btn--sm"
                onClick={() => setJobFilter('all')}
              >
                View all jobs
              </button>
            )}
          </div>
        ) : (
          <div className="fc-job-list">
            {visibleJobs.map((job) => (
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

      {/* ── Post Job Modal ── */}
      <Modal
        open={showPostForm}
        onClose={() => setShowPostForm(false)}
        title="Post a new job"
        subtitle="Fill in the details. Workers will see it immediately."
        icon="📢"
        id="post-job-modal"
      >
        <PostJobForm
          token={token}
          onJobCreated={(newJob) => {
            setMyJobs((prev) => [newJob, ...prev]);
            setJobFilter('all');
            setShowPostForm(false);
          }}
        />
      </Modal>

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
    <div className="fc-job">
      <div className="fc-job-main">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="fc-job-title">{job.title}</div>
          <div className="fc-job-meta">
            <span className={`fc-badge-dot fc-badge-dot--${job.status}`}>
              {job.status === 'open' ? 'Open' : job.status === 'assigned' ? 'Assigned' : 'Closed'}
            </span>
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

        <div className="fc-job-actions">
          {/* Primary action */}
          {(job.status === 'open' || job.status === 'assigned') && (
            <button
              id={`view-suggestions-btn-${job._id}`}
              className="fc-btn fc-btn--primary fc-btn--sm"
              onClick={() => navigate(`/employer/jobs/${job._id}/suggested`)}
            >
              {job.status === 'assigned' ? '🤝 View Assigned Job' : '⚖️ Suggested Workers'}
            </button>
          )}
          {job.status === 'closed' && (
            <button
              id={`view-result-btn-${job._id}`}
              className="fc-btn fc-btn--ghost fc-btn--sm"
              onClick={() => navigate(`/employer/jobs/${job._id}/suggested`)}
            >
              🏆 View Result
            </button>
          )}

          {/* Chat button */}
          {hasAccepted && onOpenChat && (
            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
              <button
                className="fc-btn fc-btn--ghost fc-btn--sm"
                onClick={onOpenChat}
                aria-label="Chat with worker"
              >
                💬 Chat
              </button>
              {unreadCount > 0 && (
                <span className="fc-unread" style={{ position: 'absolute', top: -6, right: -6 }}>
                  {unreadCount}
                </span>
              )}
            </div>
          )}

          {/* ⋯ More menu */}
          {hasAccepted && (
            <DropdownMenu
              label="More actions"
              align="right"
              trigger={
                <button className="fc-more" aria-label="More options">⋯</button>
              }
              items={[
                {
                  label: showContact ? 'Hide Contact' : 'Contact info',
                  icon: '👤',
                  onClick: () => setShowContact((p) => !p),
                },
                {
                  label: 'Rate worker',
                  icon: '⭐',
                  onClick: () => onRateWorker && onRateWorker({
                    workerId: job.acceptedApplication.worker?._id || job.acceptedApplication.worker,
                    workerName: job.acceptedApplication.worker?.name || 'Worker',
                    jobId: job._id,
                    jobTitle: job.title,
                  }),
                },
              ]}
            />
          )}
        </div>
      </div>

      {showContact && hasAccepted && (
        <div className="fc-job-extra">
          <ContactCard applicationId={job.acceptedApplication._id} token={token} />
        </div>
      )}
    </div>
  );
}
