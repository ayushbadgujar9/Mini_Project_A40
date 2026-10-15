import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const API = 'http://localhost:5000';

function formatDate(iso) {
  if (!iso) return 'N/A';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

const SKILL_ICONS = {
  construction: '🏗️', carpentry: '🪚', plumbing: '🔧', electrical: '⚡',
  cleaning: '🧹', driving: '🚗', painting: '🎨', welding: '🔥',
  masonry: '🧱', gardening: '🌱', security: '🛡️', cooking: '👨‍🍳',
};

const COMMON_REJECTION_REASONS = [
  'Blurry or unreadable ID image',
  'Name on document does not match user profile',
  'Unsupported or invalid government ID type',
  'Document expired or missing photo',
  'Image cropped or key details hidden',
];

export default function AdminDashboard() {
  const { token, logout } = useAuth();
  const navigate = useNavigate();

  // Navigation tab state: 'overview' | 'verifications' | 'jobs' | 'fairness'
  const [activeTab, setActiveTab] = useState('overview');

  // Data states
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalWorkers: 0,
    totalEmployers: 0,
    activeJobs: 0,
    totalJobs: 0,
    pendingReviews: 0,
    verified: 0,
  });

  const [verifications, setVerifications] = useState([]);
  const [verifiedWorkers, setVerifiedWorkers] = useState([]);
  const [verificationFilter, setVerificationFilter] = useState('pending'); // 'pending' | 'verified' | 'all'

  const [jobs, setJobs] = useState([]);
  const [jobFilter, setJobFilter] = useState('all'); // 'all' | 'flagged' | 'open'
  const [jobSearch, setJobSearch] = useState('');

  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null); // { message, type }

  // Action states
  const [approvingId, setApprovingId] = useState(null);
  const [rejectingWorker, setRejectingWorker] = useState(null); // worker object when modal open
  const [rejectionReason, setRejectionReason] = useState(COMMON_REJECTION_REASONS[0]);
  const [customReason, setCustomReason] = useState('');
  const [submittingReject, setSubmittingReject] = useState(false);

  // Lightbox for ID images
  const [lightboxUrl, setLightboxUrl] = useState(null);

  const authHeaders = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  // Toast notification trigger
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // ── Fetch Platform Metrics ────────────────────────────────────────────────
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/admin/stats`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (_) {}
  }, [token]);

  // ── Fetch Pending Verifications ───────────────────────────────────────────
  const fetchVerifications = useCallback(async () => {
    try {
      const [verifRes, verifiedRes] = await Promise.all([
        fetch(`${API}/api/admin/verifications`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/api/admin/workers/verified`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (verifRes.ok) {
        const data = await verifRes.json();
        setVerifications(data.verifications || data.workers || []);
      } else {
        // Fallback to legacy endpoint
        const legacyRes = await fetch(`${API}/api/admin/workers/pending`, { headers: { Authorization: `Bearer ${token}` } });
        if (legacyRes.ok) {
          const legacyData = await legacyRes.json();
          setVerifications(legacyData.workers || []);
        }
      }

      if (verifiedRes.ok) {
        const data = await verifiedRes.json();
        setVerifiedWorkers(data.workers || []);
      }
    } catch (err) {
      setError('Failed to load worker verifications.');
    }
  }, [token]);

  // ── Fetch Job Postings ────────────────────────────────────────────────────
  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/admin/jobs`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setJobs(data.jobs || []);
      }
    } catch (err) {
      setError('Failed to load job listings.');
    }
  }, [token]);

  // Master refresh
  const loadAllData = useCallback(async () => {
    setLoading(true);
    setError('');
    await Promise.all([fetchStats(), fetchVerifications(), fetchJobs()]);
    setLoading(false);
  }, [fetchStats, fetchVerifications, fetchJobs]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // ── Approve Worker Verification ─────────────────────────────────────────
  const handleApproveUser = async (worker) => {
    setApprovingId(worker._id || worker.userId);
    try {
      const res = await fetch(`${API}/api/admin/verify-user/${worker._id || worker.userId}`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ verificationStatus: 'verified' }),
      });

      if (!res.ok) {
        // Try fallback PUT endpoint
        const fallbackRes = await fetch(`${API}/api/admin/workers/${worker._id || worker.userId}/verify`, {
          method: 'PUT',
          headers: authHeaders,
        });
        if (!fallbackRes.ok) throw new Error((await fallbackRes.json()).message);
      }

      // Optimistic state update
      const workerId = worker._id || worker.userId;
      setVerifications((prev) => prev.filter((w) => (w._id || w.userId) !== workerId));
      setVerifiedWorkers((prev) => [{ ...worker, isVerified: true, verificationStatus: 'verified' }, ...prev]);
      setStats((prev) => ({
        ...prev,
        pendingReviews: Math.max(0, prev.pendingReviews - 1),
        pending: Math.max(0, prev.pending - 1),
        verified: (prev.verified || 0) + 1,
      }));

      showToast(`✅ "${worker.name || worker.fullName}" has been approved and verified!`, 'success');
    } catch (err) {
      setError(err.message || 'Approval failed.');
    } finally {
      setApprovingId(null);
    }
  };

  // ── Reject Worker Verification (Opens Modal) ──────────────────────────────
  const handleOpenRejectModal = (worker) => {
    setRejectingWorker(worker);
    setRejectionReason(COMMON_REJECTION_REASONS[0]);
    setCustomReason('');
  };

  const handleConfirmReject = async () => {
    if (!rejectingWorker) return;
    const finalReason = rejectionReason === 'Other (specify below)' || customReason
      ? (customReason || rejectionReason)
      : rejectionReason;

    const workerId = rejectingWorker._id || rejectingWorker.userId;
    setSubmittingReject(true);

    try {
      const res = await fetch(`${API}/api/admin/verify-user/${workerId}`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({
          verificationStatus: 'rejected',
          rejectionReason: finalReason,
        }),
      });

      if (!res.ok) {
        // Fallback delete
        await fetch(`${API}/api/admin/workers/${workerId}`, {
          method: 'DELETE',
          headers: authHeaders,
        });
      }

      setVerifications((prev) => prev.filter((w) => (w._id || w.userId) !== workerId));
      setStats((prev) => ({
        ...prev,
        pendingReviews: Math.max(0, prev.pendingReviews - 1),
        pending: Math.max(0, prev.pending - 1),
      }));

      showToast(`❌ Verification for "${rejectingWorker.name || rejectingWorker.fullName}" rejected.`, 'warning');
      setRejectingWorker(null);
    } catch (err) {
      setError(err.message || 'Rejection failed.');
    } finally {
      setSubmittingReject(false);
    }
  };

  // ── Toggle Flag Job ───────────────────────────────────────────────────────
  const handleToggleFlagJob = async (job) => {
    const nextFlagState = !job.isFlagged;
    try {
      const res = await fetch(`${API}/api/admin/jobs/${job._id}/flag`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ isFlagged: nextFlagState }),
      });

      if (res.ok) {
        const data = await res.json();
        setJobs((prev) => prev.map((j) => (j._id === job._id ? { ...j, isFlagged: nextFlagState } : j)));
        showToast(nextFlagState ? `🚩 Job "${job.title}" flagged.` : `✅ Job "${job.title}" unflagged.`, 'info');
      }
    } catch (err) {
      showToast('Failed to update job flag status.', 'error');
    }
  };

  // ── Delete Job Posting ───────────────────────────────────────────────────
  const handleDeleteJob = async (job) => {
    const confirmed = window.confirm(
      `⚠️ Remove Job Posting?\n\nTitle: "${job.title}"\nEmployer: ${job.employerId?.name || 'Unknown'}\n\nThis will permanently delete this job listing.`
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`${API}/api/admin/jobs/${job._id}`, {
        method: 'DELETE',
        headers: authHeaders,
      });

      if (!res.ok) throw new Error((await res.json()).message);

      setJobs((prev) => prev.filter((j) => j._id !== job._id));
      setStats((prev) => ({ ...prev, activeJobs: Math.max(0, prev.activeJobs - (job.status === 'open' ? 1 : 0)) }));
      showToast(`🗑️ Job posting "${job.title}" deleted successfully.`, 'warning');
    } catch (err) {
      setError(err.message || 'Failed to delete job.');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  // Filtered jobs list
  const filteredJobs = jobs.filter((job) => {
    if (jobFilter === 'flagged' && !job.isFlagged) return false;
    if (jobFilter === 'open' && job.status !== 'open') return false;
    if (jobSearch.trim()) {
      const q = jobSearch.toLowerCase();
      const matchTitle = job.title?.toLowerCase().includes(q);
      const matchEmp = job.employerId?.name?.toLowerCase().includes(q);
      const matchCity = job.city?.toLowerCase().includes(q);
      return matchTitle || matchEmp || matchCity;
    }
    return true;
  });

  const flaggedCount = jobs.filter((j) => j.isFlagged).length;

  return (
    <div className="dashboard-page admin-theme">
      {/* ── Top Navigation Bar ──────────────────────────────────────────────── */}
      <header className="dashboard-header admin-navbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div className="brand-icon" style={{ width: 40, height: 40, fontSize: '1.2rem', background: 'linear-gradient(135deg, #e11d48, #be123c)' }}>
            🛡️
          </div>
          <div>
            <h1 className="dashboard-title" style={{ fontSize: '1.25rem', fontWeight: 800 }}>FairConnect</h1>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
              Admin Verification & Moderation Dashboard
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span className="role-badge admin">
            Admin Portal
          </span>
          <button id="admin-refresh-btn" className="btn-refresh" onClick={loadAllData} title="Refresh data">
            ↻ Refresh
          </button>
          <button id="admin-logout-btn" className="btn-logout" onClick={handleLogout}>
            Sign Out
          </button>
        </div>
      </header>

      {/* ── Toast Notification Banner ─────────────────────────────────────── */}
      {toast && (
        <div className={`admin-toast ${toast.type}`} role="status">
          <span>{toast.type === 'warning' ? '⚠️' : toast.type === 'info' ? 'ℹ️' : '✅'}</span>
          <span>{toast.message}</span>
        </div>
      )}

      {/* ── Error Banner ───────────────────────────────────────────────────── */}
      {error && (
        <div className="alert alert-error" style={{ maxWidth: 1000, margin: '1rem auto' }}>
          <span>⚠️</span> {error}
        </div>
      )}

      {/* ── Main Layout Container (Sidebar + Content) ────────────────────── */}
      <div className="admin-container">
        {/* Sidebar Navigation */}
        <aside className="admin-sidebar">
          <nav className="admin-nav-menu">
            <button
              id="nav-overview"
              className={`admin-nav-btn ${activeTab === 'overview' ? 'active' : ''}`}
              onClick={() => setActiveTab('overview')}
            >
              <span className="nav-icon">📊</span>
              <span>Overview & Metrics</span>
            </button>

            <button
              id="nav-verifications"
              className={`admin-nav-btn ${activeTab === 'verifications' ? 'active' : ''}`}
              onClick={() => setActiveTab('verifications')}
            >
              <span className="nav-icon">🪪</span>
              <span>Worker Verifications</span>
              {verifications.length > 0 && (
                <span className="nav-badge alert-badge">{verifications.length}</span>
              )}
            </button>

            <button
              id="nav-jobs"
              className={`admin-nav-btn ${activeTab === 'jobs' ? 'active' : ''}`}
              onClick={() => setActiveTab('jobs')}
            >
              <span className="nav-icon">🛡️</span>
              <span>Job Moderation</span>
              {flaggedCount > 0 && (
                <span className="nav-badge flag-badge">🚩 {flaggedCount}</span>
              )}
            </button>

            <button
              id="nav-fairness"
              className={`admin-nav-btn ${activeTab === 'fairness' ? 'active' : ''}`}
              onClick={() => setActiveTab('fairness')}
            >
              <span className="nav-icon">⚖️</span>
              <span>Fairness Audit</span>
            </button>
          </nav>

          {/* Quick System Summary */}
          <div className="admin-sidebar-footer">
            <div className="system-status-indicator">
              <span className="status-dot online" /> System Operational
            </div>
            <p style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.4rem' }}>
              Logged in as System Admin
            </p>
          </div>
        </aside>

        {/* Content Area */}
        <main className="admin-content">
          {/* ─────────────────────────────────────────────────────────────── */}
          {/* TAB 1: OVERVIEW & METRICS CARDS */}
          {/* ─────────────────────────────────────────────────────────────── */}
          {activeTab === 'overview' && (
            <div className="admin-section">
              <div className="section-header-box">
                <h2>Platform Overview & Metrics</h2>
                <p>Real-time platform activity metrics, user counts, and review queue status.</p>
              </div>

              {/* Stat Cards Grid */}
              <div className="admin-metrics-grid">
                <MetricCard
                  icon="👥"
                  title="Total Users"
                  value={stats.totalUsers || (stats.totalWorkers + stats.totalEmployers + 1)}
                  subtitle="Workers, Employers & Admins"
                  color="#3b82f6"
                />

                <MetricCard
                  icon="👷"
                  title="Total Workers"
                  value={stats.totalWorkers || stats.total || 0}
                  subtitle={`${stats.verified || 0} Verified • ${(stats.totalWorkers || stats.total || 0) - (stats.verified || 0)} Unverified`}
                  color="#10b981"
                />

                <MetricCard
                  icon="🏢"
                  title="Total Employers"
                  value={stats.totalEmployers || 0}
                  subtitle="Active Job Creators"
                  color="#f59e0b"
                />

                <MetricCard
                  icon="💼"
                  title="Active Jobs"
                  value={stats.activeJobs || 0}
                  subtitle={`${stats.totalJobs || jobs.length} Total Postings`}
                  color="#8b5cf6"
                />

                <MetricCard
                  icon="⏳"
                  title="Pending Identity Reviews"
                  value={stats.pendingReviews ?? stats.pendingIdentityReviews ?? verifications.length}
                  subtitle="Awaiting Admin Review"
                  color="#e11d48"
                  isAlert={verifications.length > 0}
                />
              </div>

              {/* Quick Action Tiles */}
              <div className="quick-actions-grid" style={{ marginTop: '2rem' }}>
                <div className="action-tile" onClick={() => setActiveTab('verifications')}>
                  <div className="tile-icon">🪪</div>
                  <div className="tile-body">
                    <h3>Review Worker Identities ({verifications.length})</h3>
                    <p>Inspect uploaded ID documents and OCR text extractions to approve or reject profiles.</p>
                  </div>
                  <span className="tile-arrow">→</span>
                </div>

                <div className="action-tile" onClick={() => setActiveTab('jobs')}>
                  <div className="tile-icon">🛡️</div>
                  <div className="tile-body">
                    <h3>Moderate Job Listings ({jobs.length})</h3>
                    <p>Review active job listings, inspect flagged/reported posts, and remove spam listings.</p>
                  </div>
                  <span className="tile-arrow">→</span>
                </div>
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────── */}
          {/* TAB 2: WORKER VERIFICATION QUEUE */}
          {/* ─────────────────────────────────────────────────────────────── */}
          {activeTab === 'verifications' && (
            <div className="admin-section">
              <div className="section-header-box" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2>Worker Identity Verification Queue</h2>
                  <p>Review uploaded ID documents, inspect AI/OCR extracted text, and verify worker accounts.</p>
                </div>

                <div className="admin-filter-pills">
                  <button
                    className={`pill-btn ${verificationFilter === 'pending' ? 'active' : ''}`}
                    onClick={() => setVerificationFilter('pending')}
                  >
                    ⏳ Pending ({verifications.length})
                  </button>
                  <button
                    className={`pill-btn ${verificationFilter === 'verified' ? 'active' : ''}`}
                    onClick={() => setVerificationFilter('verified')}
                  >
                    ✅ Verified ({verifiedWorkers.length})
                  </button>
                </div>
              </div>

              {loading ? (
                <div className="verification-grid">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="worker-card skeleton-card">
                      <div className="skeleton sk-avatar" />
                      <div style={{ flex: 1 }}>
                        <div className="skeleton sk-line sk-w60" />
                        <div className="skeleton sk-line sk-w40" style={{ marginTop: '0.5rem' }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  {verificationFilter === 'pending' && verifications.length === 0 && (
                    <div className="admin-empty-state">
                      <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🎉</div>
                      <h3>All Catch Up!</h3>
                      <p>There are no pending identity verifications awaiting admin review right now.</p>
                    </div>
                  )}

                  {verificationFilter === 'verified' && verifiedWorkers.length === 0 && (
                    <div className="admin-empty-state">
                      <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>📋</div>
                      <h3>No Verified Workers Yet</h3>
                      <p>Approved worker accounts will appear here.</p>
                    </div>
                  )}

                  {/* Pending Verifications Queue */}
                  {verificationFilter === 'pending' && verifications.length > 0 && (
                    <div className="verification-grid">
                      {verifications.map((worker) => (
                        <WorkerVerificationCard
                          key={worker._id || worker.userId}
                          worker={worker}
                          approving={approvingId === (worker._id || worker.userId)}
                          onApprove={() => handleApproveUser(worker)}
                          onReject={() => handleOpenRejectModal(worker)}
                          onViewImage={(url) => setLightboxUrl(url)}
                        />
                      ))}
                    </div>
                  )}

                  {/* Verified Workers Queue */}
                  {verificationFilter === 'verified' && verifiedWorkers.length > 0 && (
                    <div className="verification-grid">
                      {verifiedWorkers.map((worker) => (
                        <WorkerVerificationCard
                          key={worker._id || worker.userId}
                          worker={worker}
                          isVerifiedTab={true}
                          onViewImage={(url) => setLightboxUrl(url)}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────── */}
          {/* TAB 3: JOB MODERATION TABLE */}
          {/* ─────────────────────────────────────────────────────────────── */}
          {activeTab === 'jobs' && (
            <div className="admin-section">
              <div className="section-header-box">
                <h2>Active Job Moderation Table</h2>
                <p>Filter, flag, and delete job listings to maintain safety and combat spam across the marketplace.</p>
              </div>

              {/* Controls bar */}
              <div className="moderation-controls-bar">
                <div className="search-input-wrapper">
                  <span className="search-icon">🔍</span>
                  <input
                    type="text"
                    className="search-input"
                    placeholder="Search by job title, employer name, or city..."
                    value={jobSearch}
                    onChange={(e) => setJobSearch(e.target.value)}
                  />
                  {jobSearch && (
                    <button className="clear-search-btn" onClick={() => setJobSearch('')}>✕</button>
                  )}
                </div>

                <div className="admin-filter-pills">
                  <button
                    className={`pill-btn ${jobFilter === 'all' ? 'active' : ''}`}
                    onClick={() => setJobFilter('all')}
                  >
                    All Jobs ({jobs.length})
                  </button>
                  <button
                    className={`pill-btn ${jobFilter === 'flagged' ? 'active flag' : ''}`}
                    onClick={() => setJobFilter('flagged')}
                  >
                    🚩 Flagged ({flaggedCount})
                  </button>
                  <button
                    className={`pill-btn ${jobFilter === 'open' ? 'active' : ''}`}
                    onClick={() => setJobFilter('open')}
                  >
                    🟢 Active Open
                  </button>
                </div>
              </div>

              {/* Table view */}
              {loading ? (
                <div className="admin-empty-state">
                  <p>Loading job postings...</p>
                </div>
              ) : filteredJobs.length === 0 ? (
                <div className="admin-empty-state">
                  <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🔍</div>
                  <h3>No Jobs Found</h3>
                  <p>No job postings match your selected filter or search query.</p>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="admin-jobs-table">
                    <thead>
                      <tr>
                        <th>Job Listing</th>
                        <th>Employer</th>
                        <th>Required Skill</th>
                        <th>Daily Wage & City</th>
                        <th>Status</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredJobs.map((job) => (
                        <tr key={job._id} className={job.isFlagged ? 'flagged-row' : ''}>
                          <td>
                            <div className="job-title-cell">
                              <span className="job-title-text">{job.title}</span>
                              {job.description && (
                                <span className="job-desc-snippet">{job.description.slice(0, 80)}...</span>
                              )}
                            </div>
                          </td>

                          <td>
                            <div className="employer-cell">
                              <span className="emp-name">{job.employerId?.name || 'Unknown Employer'}</span>
                              {job.employerId?.phoneNumber && (
                                <span className="emp-phone">📱 {job.employerId.phoneNumber}</span>
                              )}
                            </div>
                          </td>

                          <td>
                            <span className="skill-badge">
                              {SKILL_ICONS[job.requiredSkill] || '💼'} {job.requiredSkill}
                            </span>
                          </td>

                          <td>
                            <div className="wage-city-cell">
                              <span className="wage-text">₹{job.dailyWage}/day</span>
                              <span className="city-text">📍 {job.city || 'Not specified'}</span>
                            </div>
                          </td>

                          <td>
                            <div className="status-cell">
                              <span className={`job-status-tag ${job.status}`}>
                                {job.status === 'open' ? '🟢 Active Open' : '🔴 Filled / Closed'}
                              </span>
                              {job.isFlagged && (
                                <span className="flag-tag" title={job.flagReason || 'Flagged for review'}>
                                  🚩 Flagged
                                </span>
                              )}
                            </div>
                          </td>

                          <td style={{ textAlign: 'right' }}>
                            <div className="action-buttons-group">
                              <button
                                className={`btn-action-flag ${job.isFlagged ? 'flagged' : ''}`}
                                onClick={() => handleToggleFlagJob(job)}
                                title={job.isFlagged ? 'Unflag this job' : 'Flag suspicious job'}
                              >
                                {job.isFlagged ? '🚩 Flagged' : '🏳️ Flag'}
                              </button>

                              <button
                                className="btn-action-delete"
                                onClick={() => handleDeleteJob(job)}
                                title="Delete job posting"
                              >
                                🗑️ Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────── */}
          {/* TAB 4: FAIRNESS MATCHES AUDIT */}
          {/* ─────────────────────────────────────────────────────────────── */}
          {activeTab === 'fairness' && (
            <div className="admin-section">
              <div className="section-header-box">
                <h2>Fairness Engine Audit & Matches</h2>
                <p>Audit how workers were matched with jobs based on proximity, need, and equity scores.</p>
              </div>

              <div className="fm-summary-row">
                <div className="fm-chip open">🟢 {jobs.filter((j) => j.status === 'open').length} Active Open</div>
                <div className="fm-chip closed">🔴 {jobs.filter((j) => j.status === 'closed').length} Filled</div>
                <div className="fm-chip total">📊 {jobs.length} Total Postings</div>
              </div>

              <div className="fm-job-list" style={{ marginTop: '1rem' }}>
                {jobs.map((job) => (
                  <div key={job._id} className={`fm-job-row ${job.status === 'closed' ? 'closed' : ''}`}>
                    <div className="fm-job-left">
                      <span className="fm-skill-icon">{SKILL_ICONS[job.requiredSkill] || '💼'}</span>
                      <div>
                        <div className="fm-job-title">{job.title}</div>
                        <div className="fm-job-meta">
                          <span>🏢 {job.employerId?.name || 'Unknown Employer'}</span>
                          {job.city && <span>📍 {job.city}</span>}
                          <span>₹{job.dailyWage}/day</span>
                          <span className={`job-status-badge ${job.status}`}>
                            {job.status === 'open' ? '🟢 Open' : '🔴 Filled'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {job.status === 'closed' && job.hiredWorkerId ? (
                      <div className="fm-hired-worker">
                        <div className="fm-worker-avatar">
                          {typeof job.hiredWorkerId === 'object' && job.hiredWorkerId?.name
                            ? job.hiredWorkerId.name[0].toUpperCase()
                            : 'W'}
                        </div>
                        <div>
                          <div className="fm-worker-name">
                            {typeof job.hiredWorkerId === 'object' ? job.hiredWorkerId.name : 'Hired Worker'}
                            {job.hiredWorkerId?.isVerified && <span className="sw-verified-badge">✓</span>}
                          </div>
                          <div className="fm-worker-stats">
                            <span>🏆 {job.hiredWorkerId?.totalJobsCompleted || 0} jobs</span>
                            {job.hiredWorkerId?.city && <span>📍 {job.hiredWorkerId.city}</span>}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="fm-no-hire">
                        <span style={{ color: '#64748b', fontSize: '0.85rem' }}>
                          {job.status === 'open' ? 'Awaiting hire' : 'No worker attached'}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ── Lightbox Image Preview Modal ────────────────────────────────────── */}
      {lightboxUrl && (
        <div
          className="lightbox-overlay"
          id="admin-lightbox"
          onClick={() => setLightboxUrl(null)}
          role="dialog"
          aria-modal="true"
        >
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            <img src={lightboxUrl} alt="Uploaded Identity Document" className="lightbox-img" />
            <button className="lightbox-close" onClick={() => setLightboxUrl(null)}>✕ Close</button>
          </div>
        </div>
      )}

      {/* ── Rejection Reason Dialog Modal ─────────────────────────────────── */}
      {rejectingWorker && (
        <div className="modal-overlay" onClick={() => setRejectingWorker(null)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Reject Worker Verification</h3>
              <button className="modal-close-btn" onClick={() => setRejectingWorker(null)}>✕</button>
            </div>

            <div className="modal-body">
              <p style={{ fontSize: '0.9rem', color: '#475569', marginBottom: '1rem' }}>
                Please select or enter the reason for rejecting verification for <strong>{rejectingWorker.name || rejectingWorker.fullName}</strong>:
              </p>

              <div className="reason-options-list">
                {COMMON_REJECTION_REASONS.map((reason) => (
                  <label key={reason} className="reason-radio-label">
                    <input
                      type="radio"
                      name="rejectionReason"
                      value={reason}
                      checked={rejectionReason === reason}
                      onChange={() => setRejectionReason(reason)}
                    />
                    <span>{reason}</span>
                  </label>
                ))}

                <label className="reason-radio-label">
                  <input
                    type="radio"
                    name="rejectionReason"
                    value="Other (specify below)"
                    checked={rejectionReason === 'Other (specify below)'}
                    onChange={() => setRejectionReason('Other (specify below)')}
                  />
                  <span>Other reason...</span>
                </label>
              </div>

              {(rejectionReason === 'Other (specify below)' || customReason) && (
                <textarea
                  className="modal-textarea"
                  placeholder="Type specific rejection details or instructions for the worker..."
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  rows={3}
                />
              )}
            </div>

            <div className="modal-footer">
              <button
                className="btn-modal-cancel"
                onClick={() => setRejectingWorker(null)}
                disabled={submittingReject}
              >
                Cancel
              </button>
              <button
                className="btn-modal-reject"
                onClick={handleConfirmReject}
                disabled={submittingReject}
              >
                {submittingReject ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Metric Card Sub-component
// ─────────────────────────────────────────────────────────────────────────────
function MetricCard({ icon, title, value, subtitle, color, isAlert }) {
  return (
    <div className={`admin-metric-card ${isAlert ? 'alert-card' : ''}`}>
      <div className="metric-header">
        <span className="metric-icon" style={{ background: `${color}15`, color }}>{icon}</span>
        <span className="metric-title">{title}</span>
      </div>
      <div className="metric-value" style={{ color }}>
        {value}
      </div>
      <div className="metric-subtitle">{subtitle}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Worker Verification Queue Card
// ─────────────────────────────────────────────────────────────────────────────
function WorkerVerificationCard({ worker, isVerifiedTab, approving, onApprove, onReject, onViewImage }) {
  const imageFilename = worker.idImagePath || worker.idDocumentUrl;
  const imageUrl = imageFilename
    ? imageFilename.startsWith('http')
      ? imageFilename
      : `http://localhost:5000/uploads/${imageFilename.replace(/^\/uploads\//, '')}`
    : null;

  const ocrText = worker.ocrExtractedText || worker.idOcrText;

  return (
    <div className={`worker-verification-card ${isVerifiedTab ? 'verified-card' : ''}`}>
      {/* Top Header */}
      <div className="card-top">
        <div className="worker-avatar-circle">
          {(worker.name || worker.fullName || 'W').charAt(0).toUpperCase()}
        </div>
        <div className="worker-details">
          <h4 className="worker-name-heading">
            {worker.name || worker.fullName}
            {isVerifiedTab && <span className="verified-badge-icon">✅</span>}
          </h4>
          <div className="worker-sub-info">
            <span>📱 {worker.phoneNumber || worker.phone || 'N/A'}</span>
            <span>•</span>
            <span>🗓 {formatDate(worker.createdAt || worker.signupDate)}</span>
          </div>
        </div>
      </div>

      {/* Side-by-side ID document preview & OCR Text block */}
      <div className="verification-side-by-side">
        {/* Left / Top: ID Document Image */}
        <div className="id-document-frame">
          {imageUrl ? (
            <div className="image-preview-wrapper" onClick={() => onViewImage(imageUrl)}>
              <img src={imageUrl} alt="Government ID" className="id-preview-img" />
              <div className="image-hover-overlay">
                <span>🔍 Click to View Full Size</span>
              </div>
            </div>
          ) : (
            <div className="no-id-placeholder">
              <span>📄</span>
              <p>No ID Image Uploaded</p>
            </div>
          )}
        </div>

        {/* Right / Bottom: OCR Text Extraction Summary */}
        <div className="ocr-summary-box">
          <div className="ocr-box-header">
            <span>🤖 OCR Text Summary</span>
            <span className="ocr-tag">{ocrText ? 'Extracted' : 'Pending'}</span>
          </div>
          <div className="ocr-text-body">
            {ocrText ? (
              <p className="ocr-content">{ocrText}</p>
            ) : (
              <p className="ocr-empty">No OCR text extracted from this document.</p>
            )}
          </div>
        </div>
      </div>

      {/* Action Footer */}
      {isVerifiedTab ? (
        <div className="card-verified-footer">
          <span>✅ Identity Verified</span>
        </div>
      ) : (
        <div className="card-actions-footer">
          <button
            className="btn-approve-green"
            onClick={onApprove}
            disabled={approving || !imageUrl}
            title={!imageUrl ? 'Worker has not uploaded an ID image' : 'Approve worker verification'}
          >
            {approving ? 'Approving...' : '✅ Approve'}
          </button>

          <button
            className="btn-reject-red"
            onClick={onReject}
            disabled={approving}
          >
            ❌ Reject
          </button>
        </div>
      )}
    </div>
  );
}
