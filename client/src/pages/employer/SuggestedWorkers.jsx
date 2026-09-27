import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const API = 'http://localhost:5000';

const SKILLS = [
  { id: 'construction', label: 'Construction', icon: '🏗️' },
  { id: 'carpentry',    label: 'Carpentry',    icon: '🪚' },
  { id: 'plumbing',     label: 'Plumbing',     icon: '🔧' },
  { id: 'electrical',   label: 'Electrical',   icon: '⚡' },
  { id: 'cleaning',     label: 'Cleaning',     icon: '🧹' },
  { id: 'driving',      label: 'Driving',      icon: '🚗' },
  { id: 'painting',     label: 'Painting',     icon: '🎨' },
  { id: 'welding',      label: 'Welding',      icon: '🔥' },
  { id: 'masonry',      label: 'Masonry',      icon: '🧱' },
  { id: 'gardening',    label: 'Gardening',    icon: '🌱' },
  { id: 'security',     label: 'Security',     icon: '🛡️' },
  { id: 'cooking',      label: 'Cooking',      icon: '👨‍🍳' },
];

// Score breakdown colours
const scoreColor = (score) => {
  if (score >= 80) return '#34d399'; // emerald
  if (score >= 50) return '#f59e0b'; // amber
  return '#94a3b8';                  // slate
};

export default function SuggestedWorkers() {
  const { jobId } = useParams();
  const { token } = useAuth();
  const navigate  = useNavigate();

  const [data,    setData]    = useState(null);   // { job, workers }
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  // Complete-job state
  const [completing,    setCompleting]    = useState(null);  // workerId being processed
  const [completeMsg,   setCompleteMsg]   = useState(null);  // { type, text }

  useEffect(() => {
    if (!token || !jobId) return;
    fetch(`${API}/api/jobs/matches/${jobId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.workers) setData(d);
        else setError(d.message || 'Failed to load suggestions.');
      })
      .catch(() => setError('Network error.'))
      .finally(() => setLoading(false));
  }, [token, jobId]);

  const handleMarkComplete = async (workerId, workerName) => {
    if (!window.confirm(`Mark this job complete and credit "${workerName}"?`)) return;
    setCompleting(workerId);
    setCompleteMsg(null);
    try {
      const res = await fetch(`${API}/api/jobs/${jobId}/complete`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ workerId }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message);
      setCompleteMsg({ type: 'success', text: `✅ ${d.message}` });
      // Refresh the data to show updated status
      setTimeout(() => navigate('/employer/dashboard'), 2000);
    } catch (err) {
      setCompleteMsg({ type: 'error', text: err.message || 'Failed to complete job.' });
    } finally {
      setCompleting(null);
    }
  };

  const skill = data?.job ? SKILLS.find((s) => s.id === data.job.requiredSkill) : null;
  const isJobClosed = data?.job?.status === 'closed';

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
                <span className={`job-status-badge ${data.job.status}`}>
                  {data.job.status === 'open' ? '🟢 Open' : '🔴 Closed'}
                </span>
              </div>
            </div>
          </div>
          <div className="sw-engine-badge">
            ⚖️ Fairness Engine
          </div>
        </div>
      )}

      {/* ── Alert ── */}
      {completeMsg && (
        <div className={`alert ${completeMsg.type === 'error' ? 'alert-error' : 'alert-success'}`}
             style={{ margin: '0 0 1.5rem' }}>
          <span>{completeMsg.type === 'error' ? '⚠️' : '✅'}</span>
          {completeMsg.text}
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
      ) : data.workers.length === 0 ? (
        <div className="jobs-empty">
          <div className="jobs-empty-icon">🔍</div>
          <p>No workers with the required skill found yet. Share FairConnect with workers in your area!</p>
        </div>
      ) : (
        <>
          <div className="sw-section-header">
            <div>
              <div className="section-title">Suggested Workers</div>
              <div className="section-subtitle">
                Ranked by Fairness Score — proximity · days idle · verification
              </div>
            </div>
            <div className="sw-count-badge">{data.workers.length} candidate{data.workers.length !== 1 ? 's' : ''}</div>
          </div>

          <div className="sw-grid">
            {data.workers.map((worker, idx) => (
              <WorkerCard
                key={worker._id}
                worker={worker}
                rank={idx + 1}
                isJobClosed={isJobClosed}
                completing={completing === worker._id}
                onMarkComplete={() => handleMarkComplete(worker._id, worker.name)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── WorkerCard ────────────────────────────────────────────────────────────────
function WorkerCard({ worker, rank, isJobClosed, completing, onMarkComplete }) {
  const MAX_SCORE = 100;
  const pct = Math.min((worker.fairnessScore / MAX_SCORE) * 100, 100);
  const color = scoreColor(worker.fairnessScore);

  const daysSince = worker.lastWorkedDate
    ? Math.floor((Date.now() - new Date(worker.lastWorkedDate)) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className={`sw-worker-card ${rank === 1 ? 'top-match' : ''}`}
         style={{ animationDelay: `${rank * 60}ms` }}>

      {/* Rank ribbon */}
      <div className="sw-rank">#{rank}</div>

      {/* Avatar + name */}
      <div className="sw-worker-top">
        <div className="sw-avatar">{worker.name[0].toUpperCase()}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="sw-worker-name">
            {worker.name}
            {worker.isVerified && <span className="sw-verified-badge">✓</span>}
            {rank === 1 && <span className="sw-top-label">Top Match</span>}
          </div>
          <div className="sw-worker-sub">
            {worker.city ? `📍 ${worker.city}` : '📍 City not set'}
            {' · '}
            {worker.totalJobsCompleted} job{worker.totalJobsCompleted !== 1 ? 's' : ''} completed
          </div>
        </div>
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

      {/* Action */}
      {!isJobClosed && (
        <button
          className="btn-primary sw-hire-btn"
          onClick={onMarkComplete}
          disabled={completing}
        >
          {completing
            ? <><span className="btn-spinner" />Processing…</>
            : '✅ Mark Complete & Credit Worker'}
        </button>
      )}
      {isJobClosed && (
        <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.75rem', textAlign: 'center' }}>
          Job is closed.
        </div>
      )}
    </div>
  );
}
