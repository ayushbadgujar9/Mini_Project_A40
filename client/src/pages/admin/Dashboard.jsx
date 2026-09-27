import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const API = 'http://localhost:5000';

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

// ─────────────────────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const { token, logout } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab]             = useState('pending');   // 'pending' | 'verified' | 'fairness'
  const [pending, setPending]     = useState([]);
  const [verified, setVerified]   = useState([]);
  const [fairnessJobs, setFairnessJobs] = useState([]);
  const [fairnessLoading, setFairnessLoading] = useState(false);
  const [stats, setStats]         = useState({ total: 0, verified: 0, pending: 0 });
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [approving, setApproving] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const [toast, setToast]         = useState('');
  const [toastType, setToastType] = useState('success');  // 'success' | 'reject'
  const [lightbox, setLightbox]   = useState(null);

  const authHeaders = { Authorization: `Bearer ${token}` };

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/admin/workers/stats`, { headers: authHeaders });
      if (res.ok) setStats(await res.json());
    } catch (_) {}
  }, [token]);

  const fetchWorkers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [pendingRes, verifiedRes] = await Promise.all([
        fetch(`${API}/api/admin/workers/pending`,  { headers: authHeaders }),
        fetch(`${API}/api/admin/workers/verified`, { headers: authHeaders }),
      ]);
      if (!pendingRes.ok)  throw new Error((await pendingRes.json()).message);
      if (!verifiedRes.ok) throw new Error((await verifiedRes.json()).message);

      const { workers: p } = await pendingRes.json();
      const { workers: v } = await verifiedRes.json();
      setPending(p);
      setVerified(v);
    } catch (err) {
      setError(err.message || 'Failed to load workers.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  const fetchFairnessJobs = useCallback(async () => {
    setFairnessLoading(true);
    try {
      const res = await fetch(`${API}/api/admin/jobs`, { headers: authHeaders });
      if (!res.ok) throw new Error((await res.json()).message);
      const { jobs } = await res.json();
      setFairnessJobs(jobs);
    } catch (err) {
      setError(err.message || 'Failed to load jobs.');
    } finally {
      setFairnessLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchStats();
    fetchWorkers();
  }, [fetchStats, fetchWorkers]);

  // Lazily load fairness jobs when user clicks the tab
  useEffect(() => {
    if (tab === 'fairness' && fairnessJobs.length === 0) fetchFairnessJobs();
  }, [tab]);

  const handleApprove = async (worker) => {
    setApproving(worker._id);
    try {
      const res = await fetch(`${API}/api/admin/workers/${worker._id}/verify`, {
        method: 'PUT',
        headers: authHeaders,
      });
      if (!res.ok) throw new Error((await res.json()).message);
      const data = await res.json();

      // Move worker from pending → verified list optimistically
      const approved = pending.find((w) => w._id === worker._id);
      setPending((prev) => prev.filter((w) => w._id !== worker._id));
      if (approved) setVerified((prev) => [{ ...approved, isVerified: true }, ...prev]);
      setStats((prev) => ({ ...prev, pending: prev.pending - 1, verified: prev.verified + 1 }));

      setToast(data.message);
      setToastType('success');
      setTimeout(() => setToast(''), 3500);
    } catch (err) {
      setError(err.message || 'Approval failed. Please try again.');
    } finally {
      setApproving(null);
    }
  };

  const handleReject = async (worker) => {
    const confirmed = window.confirm(
      `⚠️ Reject "${worker.name}"?\n\nThis will permanently delete their account from the database. This cannot be undone.`
    );
    if (!confirmed) return;

    setRejecting(worker._id);
    try {
      const res = await fetch(`${API}/api/admin/workers/${worker._id}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      if (!res.ok) throw new Error((await res.json()).message);
      const data = await res.json();

      setPending((prev) => prev.filter((w) => w._id !== worker._id));
      setStats((prev) => ({ ...prev, pending: prev.pending - 1, total: prev.total - 1 }));

      setToast(data.message);
      setToastType('reject');
      setTimeout(() => setToast(''), 3500);
    } catch (err) {
      setError(err.message || 'Rejection failed. Please try again.');
    } finally {
      setRejecting(null);
    }
  };

  const handleLogout = () => { logout(); navigate('/login', { replace: true }); };
  const currentList  = tab === 'pending' ? pending : verified;
  const openJobs     = fairnessJobs.filter((j) => j.status === 'open');
  const closedJobs   = fairnessJobs.filter((j) => j.status === 'closed');

  return (
    <div className="dashboard-page">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="dashboard-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div className="brand-icon" style={{ width: 36, height: 36, fontSize: '1rem' }}>🔗</div>
          <span className="dashboard-title">FairConnect — Admin</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span className="role-badge admin">Admin</span>
          <button id="admin-logout-btn" className="btn-logout" onClick={handleLogout}>Sign Out</button>
        </div>
      </header>

      {/* ── Stats Bar ──────────────────────────────────────────────────── */}
      <div className="admin-stats-bar">
        <StatCard icon="👷" label="Total Workers"  value={stats.total}    color="var(--clr-secondary)" />
        <StatCard icon="✅" label="Verified"        value={stats.verified} color="var(--clr-worker)" />
        <StatCard icon="⏳" label="Pending Review" value={stats.pending}  color="var(--clr-employer)" />
      </div>

      {/* ── Tab Switcher ────────────────────────────────────────────────── */}
      <div className="admin-tab-group">
        <button
          id="tab-pending"
          className={`admin-tab-btn ${tab === 'pending' ? 'active' : ''}`}
          onClick={() => setTab('pending')}
        >
          <span>⏳</span> Pending Review
          {pending.length > 0 && (
            <span className="tab-count">{pending.length}</span>
          )}
        </button>
        <button
          id="tab-verified"
          className={`admin-tab-btn ${tab === 'verified' ? 'active verified' : ''}`}
          onClick={() => setTab('verified')}
        >
          <span>✅</span> Verified Workers
          {verified.length > 0 && (
            <span className="tab-count verified">{verified.length}</span>
          )}
        </button>
        <button
          id="tab-fairness"
          className={`admin-tab-btn ${tab === 'fairness' ? 'active fairness' : ''}`}
          onClick={() => setTab('fairness')}
        >
          <span>⚖️</span> Fairness Matches
          {closedJobs.length > 0 && (
            <span className="tab-count fairness">{closedJobs.length}</span>
          )}
        </button>
        <button id="admin-refresh-btn" className="btn-refresh" onClick={() => { fetchStats(); fetchWorkers(); if (tab === 'fairness') fetchFairnessJobs(); }}>
          ↻ Refresh
        </button>
      </div>

      {/* ── Toast ──────────────────────────────────────────────────────── */}
      {toast && (
        <div className={`admin-toast ${toastType === 'reject' ? 'reject' : ''}`} role="status">
          <span>{toastType === 'reject' ? '🗑️' : '✅'}</span> {toast}
        </div>
      )}

      {/* ── Error ──────────────────────────────────────────────────────── */}
      {error && (
        <div className="alert alert-error" style={{ maxWidth: 700, margin: '0 auto 1.5rem' }}>
          <span>⚠️</span> {error}
        </div>
      )}

      {/* ── Loading skeletons ───────────────────────────────────────────── */}
      {loading && tab !== 'fairness' && (
        <div className="verification-grid">
          {[1, 2, 3].map((i) => (
            <div key={i} className="worker-card skeleton-card">
              <div className="skeleton sk-avatar" />
              <div style={{ flex: 1 }}>
                <div className="skeleton sk-line sk-w60" />
                <div className="skeleton sk-line sk-w40" style={{ marginTop: '0.5rem' }} />
                <div className="skeleton sk-line sk-w80" style={{ marginTop: '0.75rem' }} />
              </div>
              <div className="skeleton sk-img" />
            </div>
          ))}
        </div>
      )}

      {/* ── Empty State ─────────────────────────────────────────────────── */}
      {!loading && !error && tab !== 'fairness' && currentList.length === 0 && (
        <div className="admin-empty-state">
          <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>
            {tab === 'pending' ? '🎉' : '📋'}
          </div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.35rem', fontWeight: 700, color: 'var(--clr-text-heading)', marginBottom: '0.5rem' }}>
            {tab === 'pending' ? 'All caught up!' : 'No verified workers yet'}
          </h2>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
            {tab === 'pending'
              ? 'No workers are pending ID verification right now.'
              : 'Approved workers will appear here once you verify them.'}
          </p>
        </div>
      )}

      {/* ── Worker Cards (pending / verified tabs) ────────────────────── */}
      {tab !== 'fairness' && !loading && currentList.length > 0 && (
        <div className="verification-grid">
          {currentList.map((worker) => (
            <WorkerCard
              key={worker._id}
              worker={worker}
              isVerifiedTab={tab === 'verified'}
              approving={approving === worker._id}
              rejecting={rejecting === worker._id}
              onApprove={() => handleApprove(worker)}
              onReject={() => handleReject(worker)}
              onImageClick={(url) => setLightbox(url)}
            />
          ))}
        </div>
      )}

      {/* ── Fairness Matches Tab ─────────────────────────────────────── */}
      {tab === 'fairness' && (
        fairnessLoading ? (
          <div className="verification-grid">
            {[1,2,3].map((i) => (
              <div key={i} className="worker-card skeleton-card">
                <div className="skeleton sk-avatar" />
                <div style={{ flex: 1 }}>
                  <div className="skeleton sk-line sk-w60" />
                  <div className="skeleton sk-line sk-w40" style={{ marginTop: '0.5rem' }} />
                </div>
              </div>
            ))}
          </div>
        ) : fairnessJobs.length === 0 ? (
          <div className="admin-empty-state">
            <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>📋</div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.35rem', fontWeight: 700, color: 'var(--clr-text-heading)', marginBottom: '0.5rem' }}>
              No jobs posted yet
            </h2>
            <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Jobs will appear here once employers start posting.</p>
          </div>
        ) : (
          <>
            {/* ─ Summary chips ─ */}
            <div className="fm-summary-row">
              <div className="fm-chip open">
                <span>🟢</span> {openJobs.length} Open
              </div>
              <div className="fm-chip closed">
                <span>🔴</span> {closedJobs.length} Filled
              </div>
              <div className="fm-chip total">
                <span>📊</span> {fairnessJobs.length} Total
              </div>
            </div>

            {/* Filled (closed) jobs first */}
            {closedJobs.length > 0 && (
              <>
                <div className="fm-section-label">🏆 Filled Jobs</div>
                <div className="fm-job-list">
                  {closedJobs.map((job) => <FairnessJobRow key={job._id} job={job} />)}
                </div>
              </>
            )}

            {/* Open jobs */}
            {openJobs.length > 0 && (
              <>
                <div className="fm-section-label" style={{ marginTop: closedJobs.length > 0 ? '1.5rem' : 0 }}>🟢 Open Jobs</div>
                <div className="fm-job-list">
                  {openJobs.map((job) => <FairnessJobRow key={job._id} job={job} />)}
                </div>
              </>
            )}
          </>
        )
      )}

      {/* ── Lightbox ────────────────────────────────────────────────────── */}
      {lightbox && (
        <div
          className="lightbox-overlay"
          id="admin-lightbox"
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-modal="true"
        >
          <img
            src={lightbox}
            alt="Worker ID document"
            className="lightbox-img"
            onClick={(e) => e.stopPropagation()}
          />
          <button className="lightbox-close" onClick={() => setLightbox(null)}>✕</button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function WorkerCard({ worker, isVerifiedTab, approving, rejecting, onApprove, onReject, onImageClick }) {
  const imageUrl = worker.idImagePath
    ? `http://localhost:5000/uploads/${worker.idImagePath}`
    : null;

  return (
    <div className={`worker-card ${isVerifiedTab ? 'verified-card' : ''}`} id={`worker-card-${worker._id}`}>

      {/* ── Verified badge (top-right ribbon) */}
      {isVerifiedTab && (
        <div className="verified-ribbon">✅ Verified</div>
      )}

      <div className="worker-card-body">
        <div className="worker-avatar">{worker.name.charAt(0).toUpperCase()}</div>
        <div className="worker-info">
          <div className="worker-name">{worker.name}</div>
          <div className="worker-meta">
            <span>📱 {worker.phoneNumber}</span>
            <span style={{ color: '#334155' }}>•</span>
            <span>🗓 {formatDate(worker.createdAt)}</span>
          </div>
          {worker.skills && worker.skills.length > 0 ? (
            <div className="worker-skills">
              {worker.primarySkill && (
                <span className="skill-tag primary-skill">⭐ {worker.primarySkill}</span>
              )}
              {worker.skills
                .filter((s) => s !== worker.primarySkill)
                .slice(0, 4)
                .map((s) => <span key={s} className="skill-tag">{s}</span>)}
              {worker.skills.length > 5 && (
                <span className="skill-tag muted">+{worker.skills.length - 5} more</span>
              )}
            </div>
          ) : (
            <p style={{ fontSize: '0.78rem', color: '#475569', marginTop: '0.5rem' }}>No skills listed yet</p>
          )}
        </div>
      </div>

      {/* ── ID Image ─────────────────────────────────────────────── */}
      <div className="id-image-frame">
        {imageUrl ? (
          <>
            <img src={imageUrl} alt={`${worker.name}'s ID`} className="id-image" onClick={() => onImageClick(imageUrl)} />
            <div className="id-image-overlay" onClick={() => onImageClick(imageUrl)}>
              <span>🔍 View Full Size</span>
            </div>
          </>
        ) : (
          <div className="id-image-missing">
            <span style={{ fontSize: '2rem' }}>📄</span>
            <p>No ID uploaded</p>
          </div>
        )}
      </div>

      {/* ── Action ───────────────────────────────────────────────── */}
      {isVerifiedTab ? (
        <div className="verified-status-row">
          <span className="badge-verified">✅ ID Approved</span>
        </div>
      ) : (
        <div className="card-action-row">
          <button
            id={`approve-btn-${worker._id}`}
            className="btn-approve"
            onClick={onApprove}
            disabled={approving || rejecting || !imageUrl}
            title={!imageUrl ? 'Worker has not uploaded an ID image yet' : 'Approve this worker'}
          >
            {approving ? <><span className="btn-spinner" /> Approving…</> : '✅ Approve'}
          </button>
          <button
            id={`reject-btn-${worker._id}`}
            className="btn-reject"
            onClick={onReject}
            disabled={approving || rejecting}
          >
            {rejecting ? <><span className="btn-spinner" /> Rejecting…</> : '🗑️ Reject'}
          </button>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, color }) {
  return (
    <div className="admin-stat-card">
      <div style={{ fontSize: '1.75rem', marginBottom: '0.4rem' }}>{icon}</div>
      <div style={{ fontSize: '2rem', fontWeight: 800, color, fontFamily: 'var(--font-display)', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: '0.3rem' }}>{label}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FairnessJobRow — one row in the admin Fairness Matches tab
// ─────────────────────────────────────────────────────────────────────────────
const SKILL_ICONS = {
  construction: '🏗️', carpentry: '🪚', plumbing: '🔧', electrical: '⚡',
  cleaning: '🧹', driving: '🚗', painting: '🎨', welding: '🔥',
  masonry: '🧱', gardening: '🌱', security: '🛡️', cooking: '👨‍🍳',
};

function FairnessJobRow({ job }) {
  const skillIcon = SKILL_ICONS[job.requiredSkill] || '💼';
  const w = job.hiredWorkerId; // populated object or null

  const daysSince = w?.lastWorkedDate
    ? Math.floor((Date.now() - new Date(w.lastWorkedDate).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className={`fm-job-row ${job.status === 'closed' ? 'closed' : ''}`}>
      {/* Left — job info */}
      <div className="fm-job-left">
        <span className="fm-skill-icon">{skillIcon}</span>
        <div>
          <div className="fm-job-title">{job.title}</div>
          <div className="fm-job-meta">
            <span>🏢 {job.employerId?.name || 'Unknown'}</span>
            {job.city && <span>📍 {job.city}</span>}
            <span>₹{job.dailyWage}/day</span>
            <span className={`job-status-badge ${job.status}`}>
              {job.status === 'open' ? '🟢 Open' : '🔴 Filled'}
            </span>
          </div>
        </div>
      </div>

      {/* Right — hired worker (or placeholder) */}
      {job.status === 'closed' && w ? (
        <div className="fm-hired-worker">
          <div className="fm-worker-avatar">{w.name[0].toUpperCase()}</div>
          <div>
            <div className="fm-worker-name">
              {w.name}
              {w.isVerified && <span className="sw-verified-badge">✓</span>}
            </div>
            <div className="fm-worker-stats">
              <span>🏆 {w.totalJobsCompleted || 0} jobs</span>
              {daysSince !== null && <span>⏳ Last worked {daysSince}d ago</span>}
              {w.city && <span>📍 {w.city}</span>}
            </div>
          </div>
        </div>
      ) : job.status === 'open' ? (
        <div className="fm-no-hire">
          <span style={{ color: '#64748b', fontSize: '0.82rem' }}>Awaiting hire</span>
        </div>
      ) : (
        <div className="fm-no-hire">
          <span style={{ color: '#64748b', fontSize: '0.82rem' }}>Worker data unavailable</span>
        </div>
      )}
    </div>
  );
}
