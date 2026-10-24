import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import ChatDrawer, { ChatButton, useChatUnreadCounts } from '../../components/ChatDrawer';


const API = 'http://localhost:5000';

const SKILLS = [
  { id: 'plumbing',    label: 'Plumbing',    icon: '🔧' },
  { id: 'electrician', label: 'Electrician', icon: '⚡' },
  { id: 'masonry',     label: 'Masonry',     icon: '🧱' },
];

// Score breakdown colours
const scoreColor = (score) => {
  if (score >= 80) return '#34d399'; // emerald
  if (score >= 50) return '#f59e0b'; // amber
  return '#94a3b8';                  // slate
};

export default function SuggestedWorkers() {
  const { jobId } = useParams();
  const { token, user } = useAuth();
  const navigate  = useNavigate();

  const [data,        setData]        = useState(null);
  const [activeTab,   setActiveTab]   = useState('applicants');
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);

  // Processing state for requests & complete
  const [actionWorkerId, setActionWorkerId] = useState(null);
  const [feedbackMsg,    setFeedbackMsg]    = useState(null);

  // Chat drawer
  const [chatDrawer, setChatDrawer] = useState(null);
  const unreadCounts = useChatUnreadCounts(token);


  const fetchMatches = useCallback(async () => {
    if (!token || !jobId) return;
    try {
      const res = await fetch(`${API}/api/jobs/matches/${jobId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await res.json();
      if (d.workers || d.allWorkers) {
        setData(d);
        if (d.applicants && d.applicants.length > 0) {
          setActiveTab('applicants');
        }
      } else {
        setError(d.message || 'Failed to load suggestions.');
      }
    } catch {
      setError('Network error.');
    } finally {
      setLoading(false);
    }
  }, [token, jobId]);

  useEffect(() => {
    fetchMatches();
  }, [fetchMatches]);

  // Employer sends job request to worker
  const handleSendRequest = async (workerId, workerName) => {
    setActionWorkerId(workerId);
    setFeedbackMsg(null);
    try {
      const res = await fetch(`${API}/api/jobs/${jobId}/request-worker`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ workerId }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message);
      setFeedbackMsg({ type: 'success', text: `📩 Request sent to ${workerName}. The worker will accept or reject the job.` });
      await fetchMatches();
    } catch (err) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Failed to send request.' });
    } finally {
      setActionWorkerId(null);
    }
  };

  // Employer cancels pending job request
  const handleCancelRequest = async (workerId) => {
    setActionWorkerId(workerId);
    setFeedbackMsg(null);
    try {
      const res = await fetch(`${API}/api/jobs/${jobId}/cancel-request`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message);
      setFeedbackMsg({ type: 'info', text: 'Job request cancelled.' });
      await fetchMatches();
    } catch (err) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Failed to cancel request.' });
    } finally {
      setActionWorkerId(null);
    }
  };

  // Mark job complete and credit worker
  const handleMarkComplete = async (workerId, workerName) => {
    if (!window.confirm(`Mark this job complete and credit "${workerName}"?`)) return;
    setActionWorkerId(workerId);
    setFeedbackMsg(null);
    try {
      const res = await fetch(`${API}/api/jobs/${jobId}/complete`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ workerId }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message);
      setFeedbackMsg({ type: 'success', text: `✅ ${d.message}` });
      await fetchMatches();
      setTimeout(() => navigate('/employer/dashboard'), 2500);
    } catch (err) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Failed to complete job.' });
    } finally {
      setActionWorkerId(null);
    }
  };

  const skill = data?.job
    ? SKILLS.find(
        (s) =>
          s.id === data.job.requiredSkill ||
          (data.job.requiredSkill === 'plumber' && s.id === 'plumbing') ||
          (data.job.requiredSkill === 'electrical' && s.id === 'electrician') ||
          (data.job.requiredSkill === 'masonary' && s.id === 'masonry')
      )
    : null;

  const jobStatus = data?.job?.status || 'open';
  const pendingWorkerId = data?.job?.offerPendingWorkerId;
  const assignedWorkerId = data?.job?.assignedWorkerId || data?.job?.hiredWorkerId;

  const applicantsList = data?.applicants || (data?.workers || []).filter((w) => w.hasApplied);
  const allWorkersList = data?.allWorkers || data?.workers || [];
  const currentWorkers = activeTab === 'applicants' ? applicantsList : allWorkersList;

  return (
    <div className="dashboard-page">
      {/* ── Header ── */}
      <header className="dashboard-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div className="brand-icon" style={{ width: 36, height: 36, fontSize: '1rem' }}>🔗</div>
          <span className="dashboard-title">FairConnect</span>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <span className="role-badge employer">Employer</span>
          <button className="btn-secondary" onClick={() => navigate('/employer/dashboard')}>
            ← Back to Dashboard
          </button>
        </div>
      </header>

      {/* ── Job summary card ── */}
      {data?.job && (
        <div className="sw-job-banner">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '2rem' }}>{skill?.icon || '💼'}</span>
            <div>
              <div className="sw-job-title">{data.job.title}</div>
              <div className="sw-job-meta">
                {skill && <span className="skill-pill">{skill.icon} {skill.label}</span>}
                <span className="wage-badge">₹{data.job.dailyWage}/day</span>
                {data.job.city && <span className="sw-city-tag">📍 {data.job.city}</span>}
                <span className={`job-status-badge ${jobStatus}`}>
                  {jobStatus === 'open' ? '🟢 Open for Requests' : jobStatus === 'assigned' ? '🔒 Assigned & Freezed' : '🔴 Closed'}
                </span>
              </div>
            </div>
          </div>
          <div className="sw-engine-badge">
            ⚖️ Fairness Engine
          </div>
        </div>
      )}

      {/* ── Freezed Banner (When worker accepted and job is assigned) ── */}
      {jobStatus === 'assigned' && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          padding: '1.25rem 1.5rem',
          borderRadius: 'var(--radius-lg, 16px)',
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(5, 150, 105, 0.05))',
          border: '1px solid rgba(16, 185, 129, 0.35)',
          marginBottom: '1.5rem',
          animation: 'fadeIn 300ms ease',
        }}>
          <span style={{ fontSize: '2rem' }}>🔒</span>
          <div>
            <div style={{ fontWeight: 800, color: '#34d399', fontSize: '1rem', marginBottom: '0.2rem' }}>
              Job is Frozen and Assigned
            </div>
            <div style={{ color: '#cbd5e1', fontSize: '0.88rem', lineHeight: 1.5 }}>
              The worker accepted your request! This job is now <strong>completely hidden & frozen</strong> from all other workers.
              Once the job is completed, click <strong>Mark Complete & Credit Worker</strong> below to finalize and record their score.
            </div>
          </div>
        </div>
      )}

      {/* ── Alert ── */}
      {feedbackMsg && (
        <div className={`alert ${feedbackMsg.type === 'error' ? 'alert-error' : 'alert-success'}`}
             style={{ margin: '0 0 1.5rem' }}>
          <span>{feedbackMsg.type === 'error' ? '⚠️' : '✅'}</span>
          {feedbackMsg.text}
        </div>
      )}

      {/* ── Content ── */}
      {loading ? (
        <div className="job-feed">
          {[1,2,3].map((n) => <div key={n} className="shimmer-card" style={{ height: 140 }} />)}
        </div>
      ) : error ? (
        <div className="jobs-empty">
          <div className="jobs-empty-icon">⚠️</div>
          <p>{error}</p>
        </div>
      ) : (
        <>
          {/* ── Two Tabs: Applicants vs All Matching Workers ── */}
          <div style={{
            display: 'flex',
            background: 'rgba(255, 255, 255, 0.04)',
            padding: '6px',
            borderRadius: 'var(--radius-lg, 16px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            gap: '8px',
            marginBottom: '1.5rem',
            maxWidth: '520px',
          }}>
            <button
              id="tab-applicants-btn"
              onClick={() => setActiveTab('applicants')}
              style={{
                flex: 1,
                padding: '0.7rem 1rem',
                border: 'none',
                borderRadius: 'calc(var(--radius-lg, 16px) - 6px)',
                fontWeight: 700,
                fontSize: '0.9rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                transition: 'all 200ms ease',
                background: activeTab === 'applicants' ? 'var(--grad-primary, linear-gradient(135deg, #10b981, #059669))' : 'transparent',
                color: activeTab === 'applicants' ? '#fff' : 'var(--clr-text-dim, #94a3b8)',
                boxShadow: activeTab === 'applicants' ? '0 4px 16px rgba(16,185,129,0.25)' : 'none',
              }}
            >
              <span>📨 Applicants</span>
              <span style={{
                background: activeTab === 'applicants' ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.08)',
                padding: '0.15rem 0.55rem',
                borderRadius: '999px',
                fontSize: '0.75rem',
                fontWeight: 800,
              }}>
                {applicantsList.length}
              </span>
            </button>

            <button
              id="tab-all-workers-btn"
              onClick={() => setActiveTab('all')}
              style={{
                flex: 1,
                padding: '0.7rem 1rem',
                border: 'none',
                borderRadius: 'calc(var(--radius-lg, 16px) - 6px)',
                fontWeight: 700,
                fontSize: '0.9rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                transition: 'all 200ms ease',
                background: activeTab === 'all' ? 'var(--grad-primary, linear-gradient(135deg, #10b981, #059669))' : 'transparent',
                color: activeTab === 'all' ? '#fff' : 'var(--clr-text-dim, #94a3b8)',
                boxShadow: activeTab === 'all' ? '0 4px 16px rgba(16,185,129,0.25)' : 'none',
              }}
            >
              <span>🌐 All Matching Workers</span>
              <span style={{
                background: activeTab === 'all' ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.08)',
                padding: '0.15rem 0.55rem',
                borderRadius: '999px',
                fontSize: '0.75rem',
                fontWeight: 800,
              }}>
                {allWorkersList.length}
              </span>
            </button>
          </div>

          {/* ── Tab Header Info ── */}
          <div className="sw-section-header">
            <div>
              <div className="section-title">
                {activeTab === 'applicants' ? 'Workers Who Applied' : 'All Matching Workers in Network'}
              </div>
              <div className="section-subtitle">
                {activeTab === 'applicants'
                  ? 'Workers who actively applied — send them a request to offer the job'
                  : 'Qualified workers registered on FairConnect — send any of them a request to offer the job'}
              </div>
            </div>
            <div className="sw-count-badge">
              {currentWorkers.length} candidate{currentWorkers.length !== 1 ? 's' : ''}
            </div>
          </div>

          {/* ── Empty State ── */}
          {activeTab === 'applicants' && applicantsList.length === 0 ? (
            <div className="jobs-empty" style={{ padding: '3.5rem 1.5rem', textAlign: 'center' }}>
              <div className="jobs-empty-icon" style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>📬</div>
              <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem', color: '#f8fafc' }}>
                No workers have applied for this job yet
              </h3>
              <p style={{ maxWidth: '440px', margin: '0 auto 1.5rem', color: '#94a3b8', fontSize: '0.92rem', lineHeight: 1.6 }}>
                Workers who see your posting in their feed will appear here once they apply.
                You can also browse <strong>All Matching Workers</strong> to send direct requests immediately.
              </p>
              <button
                className="btn-primary"
                style={{ padding: '0.75rem 1.5rem', fontSize: '0.9rem' }}
                onClick={() => setActiveTab('all')}
              >
                🌐 View All {allWorkersList.length} Matching Workers
              </button>
            </div>
          ) : activeTab === 'all' && allWorkersList.length === 0 ? (
            <div className="jobs-empty">
              <div className="jobs-empty-icon">🔍</div>
              <p>No workers with the required skill found yet. Share FairConnect with workers in your area!</p>
            </div>
          ) : (
            <div className="sw-grid">
              {currentWorkers.map((worker, idx) => (
              <WorkerCard
                key={worker._id}
                worker={worker}
                rank={idx + 1}
                jobStatus={jobStatus}
                pendingWorkerId={pendingWorkerId}
                assignedWorkerId={assignedWorkerId}
                processing={actionWorkerId === worker._id}
                onSendRequest={() => handleSendRequest(worker._id, worker.name)}
                onCancelRequest={() => handleCancelRequest(worker._id)}
                onMarkComplete={() => handleMarkComplete(worker._id, worker.name)}
                unreadCount={worker.applicationId ? (unreadCounts[worker.applicationId] || 0) : 0}
                onOpenChat={worker.applicationId ? () => setChatDrawer({
                  applicationId: worker.applicationId,
                  otherPartyName: worker.name,
                  isReadOnly: jobStatus === 'closed',
                }) : null}
              />
              ))}
            </div>
          )}
        </>
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

// ── WorkerCard ────────────────────────────────────────────────────────────────
function WorkerCard({
  worker,
  rank,
  jobStatus,
  pendingWorkerId,
  assignedWorkerId,
  processing,
  onSendRequest,
  onCancelRequest,
  onMarkComplete,
  unreadCount = 0,
  onOpenChat,
}) {
  const MAX_SCORE = 100;
  const pct = Math.min((worker.fairnessScore / MAX_SCORE) * 100, 100);
  const color = scoreColor(worker.fairnessScore);

  const daysSince = worker.lastWorkedDate
    ? Math.floor((Date.now() - new Date(worker.lastWorkedDate)) / (1000 * 60 * 60 * 24))
    : null;

  const isPendingWithThisWorker = worker.isOfferPending || pendingWorkerId?.toString() === worker._id?.toString();
  const isAssignedToThisWorker = worker.isAssigned || assignedWorkerId?.toString() === worker._id?.toString();
  const hasPendingOfferWithOther = pendingWorkerId && !isPendingWithThisWorker;

  return (
    <div className={`sw-worker-card ${rank === 1 ? 'top-match' : ''}`}
         style={{ animationDelay: `${rank * 60}ms` }}>

      {/* Rank ribbon */}
      <div className="sw-rank">#{rank}</div>

      {/* Avatar + name */}
      <div className="sw-worker-top">
        <div className="sw-avatar">{worker.name[0].toUpperCase()}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="sw-worker-name" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
            <span>{worker.name}</span>
            {worker.isVerified && <span className="sw-verified-badge" title="ID Verified">✓</span>}
            {rank === 1 && <span className="sw-top-label">Top Match</span>}
          </div>
          <div className="sw-worker-sub">
            {worker.city ? `📍 ${worker.city}` : '📍 City not set'}
            {' · '}
            {worker.totalJobsCompleted} job{worker.totalJobsCompleted !== 1 ? 's' : ''} completed
          </div>
        </div>
      </div>

      {/* Application Status Badge */}
      <div style={{ marginTop: '0.2rem', marginBottom: '0.2rem' }}>
        {worker.hasApplied ? (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.3rem',
            fontSize: '0.75rem',
            fontWeight: 700,
            padding: '0.2rem 0.6rem',
            borderRadius: '999px',
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.35)',
            color: '#34d399',
          }}>
            📨 Applied for this job
          </span>
        ) : (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.3rem',
            fontSize: '0.72rem',
            fontWeight: 600,
            padding: '0.2rem 0.55rem',
            borderRadius: '999px',
            background: 'rgba(148, 163, 184, 0.1)',
            border: '1px solid rgba(148, 163, 184, 0.2)',
            color: '#94a3b8',
          }}>
            ⏳ Matching Worker (Not yet applied)
          </span>
        )}
      </div>

      {/* Score bar */}
      <div className="sw-score-row">
        <span className="sw-score-label">Fairness Score</span>
        <span className="sw-score-value" style={{ color }}>{worker.fairnessScore}/100</span>
      </div>
      <div className="sw-score-bar-bg">
        <div
          className="sw-score-bar-fill"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>

      {/* Score breakdown pills */}
      <div className="sw-breakdown">
        {worker.isVerified && (
          <span className="sw-pill verified">✓ Verified +20</span>
        )}
        {worker.city && (
          <span className="sw-pill proximity">📍 Local +30</span>
        )}
        <span className="sw-pill need">
          ⏳ {daysSince === null ? 'New worker' : daysSince === 0 ? 'Worked today' : `Idle ${daysSince}d`}
        </span>
        <span className="sw-pill jobs">
          🏆 {worker.totalJobsCompleted} jobs
        </span>
      </div>

      {/* Skills */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.75rem' }}>
        {(worker.skills || []).slice(0, 5).map((s) => (
          <span key={s} className="skill-pill" style={{ fontSize: '0.7rem' }}>{s}</span>
        ))}
        {(worker.skills || []).length > 5 && (
          <span className="skill-pill" style={{ fontSize: '0.7rem' }}>+{worker.skills.length - 5}</span>
        )}
      </div>

      {/* ── Workflow Action Buttons ── */}
      <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        {jobStatus === 'open' && (
          <>
            {isPendingWithThisWorker ? (
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <span style={{
                  flex: 1,
                  padding: '0.65rem 0.8rem',
                  borderRadius: 'var(--radius-md, 12px)',
                  background: 'rgba(245, 158, 11, 0.15)',
                  border: '1px solid rgba(245, 158, 11, 0.35)',
                  color: '#f59e0b',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  textAlign: 'center',
                }}>
                  ⏳ Request Sent (Waiting for Worker)
                </span>
                <button
                  className="btn-secondary"
                  style={{ padding: '0.65rem 0.85rem', fontSize: '0.8rem' }}
                  onClick={onCancelRequest}
                  disabled={processing}
                  title="Cancel Request"
                >
                  Cancel
                </button>
              </div>
            ) : hasPendingOfferWithOther ? (
              <span style={{
                padding: '0.65rem 0.8rem',
                borderRadius: 'var(--radius-md, 12px)',
                background: 'rgba(148, 163, 184, 0.08)',
                border: '1px solid rgba(148, 163, 184, 0.2)',
                color: '#94a3b8',
                fontSize: '0.8rem',
                textAlign: 'center',
              }}>
                Offer pending with another worker
              </span>
            ) : (
              <button
                className="btn-primary"
                style={{ padding: '0.65rem 1rem', fontSize: '0.875rem' }}
                onClick={onSendRequest}
                disabled={processing}
              >
                {processing ? 'Sending Request…' : '📩 Send Job Request'}
              </button>
            )}
          </>
        )}

        {jobStatus === 'assigned' && (
          <>
            {isAssignedToThisWorker ? (
              <>
                <div style={{
                  padding: '0.5rem 0.75rem',
                  borderRadius: 'var(--radius-md, 12px)',
                  background: 'rgba(16, 185, 129, 0.12)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  color: '#34d399',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  textAlign: 'center',
                }}>
                  🤝 Assigned Worker · Job in Progress
                </div>
                <button
                  className="btn-primary sw-hire-btn"
                  onClick={onMarkComplete}
                  disabled={processing}
                  style={{ marginTop: '0.3rem' }}
                >
                  {processing ? 'Processing…' : '🏁 Mark Complete & Credit Worker'}
                </button>
                {/* Chat button for the accepted worker */}
                {onOpenChat && (
                  <ChatButton
                    applicationId={worker.applicationId || worker._id}
                    unreadCount={unreadCount}
                    onClick={onOpenChat}
                    label="💬 Chat with Worker"
                  />
                )}
              </>
            ) : (
              <div style={{
                fontSize: '0.8rem',
                color: '#64748b',
                textAlign: 'center',
                padding: '0.5rem',
              }}>
                Job assigned to another worker
              </div>
            )}
          </>
        )}

        {jobStatus === 'closed' && (
          <>
            <div style={{ fontSize: '0.82rem', color: '#64748b', textAlign: 'center', padding: '0.5rem' }}>
              {isAssignedToThisWorker ? '🏆 Completed & Credited' : 'Job is closed'}
            </div>
            {isAssignedToThisWorker && onOpenChat && (
              <ChatButton
                applicationId={worker.applicationId || worker._id}
                unreadCount={unreadCount}
                onClick={onOpenChat}
                label="💬 View Chat History"
              />
            )}
          </>
        )}
      </div>

    </div>
  );
}
