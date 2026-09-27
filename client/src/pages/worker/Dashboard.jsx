import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import JobCard from '../../components/JobCard';

const API = 'http://localhost:5000';

// ── Skill catalogue ───────────────────────────────────────────────────────────
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

export default function WorkerDashboard() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();

  // ── Profile ────────────────────────────────────────────────────────────────
  const [profile,        setProfile]        = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);

  // ── Edit skills modal ──────────────────────────────────────────────────────
  const [showEditSkills, setShowEditSkills] = useState(false);

  // ── Job feed ───────────────────────────────────────────────────────────────
  const [jobs,        setJobs]        = useState([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [skillFilter, setSkillFilter] = useState('all');

  // ── Fetch profile ──────────────────────────────────────────────────────────
  const fetchProfile = useCallback(() => {
    if (!token) return;
    fetch(`${API}/api/worker/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => setProfile(data))
      .catch(() => setProfile(null))
      .finally(() => setProfileLoading(false));
  }, [token]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  // ── Fetch jobs with personal fairness scores ──────────────────────────────
  const fetchJobs = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API}/api/jobs/my-scores`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.jobs) { setJobs(data.jobs); return; }
      throw new Error('fallback');
    } catch {
      try {
        const res2 = await fetch(`${API}/api/jobs`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data2 = await res2.json();
        setJobs((data2.jobs || []).map((j) => ({ ...j, fairnessScore: 0, isSkillMatch: false })));
      } catch {
        setJobs([]);
      }
    } finally {
      setJobsLoading(false);
    }
  }, [token]);


  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  const handleLogout = () => { logout(); navigate('/login', { replace: true }); };

  const profileIncomplete = !profileLoading && (!profile?.skills || profile.skills.length === 0);

  // ── Filtered jobs ──────────────────────────────────────────────────────────
  const filteredJobs = skillFilter === 'all'
    ? jobs
    : jobs.filter((j) => j.requiredSkill === skillFilter);

  // Skills that appear in the feed (for filter chips)
  const feedSkillIds = [...new Set(jobs.map((j) => j.requiredSkill))];

  // ── Compute live fairness estimate ─────────────────────────────────────────
  const fairnessEstimate = (() => {
    if (!profile) return null;
    let score = 0;
    let proximity = 0, need = 0, verification = 0, equity = 0;
    // Proximity — we don't know the job city, so show 0 (explained in card)
    // Need — days since last worked
    if (profile.lastWorkedDate) {
      const daysSince = Math.floor(
        (Date.now() - new Date(profile.lastWorkedDate).getTime()) / (1000 * 60 * 60 * 24)
      );
      need = Math.min(daysSince, 50);
    } else {
      need = 50; // never worked
    }
    // Verification
    if (profile.isVerified) { verification = 20; }
    // Equity penalty
    const penaltyPer10 = Math.min(Math.floor((profile.totalJobsCompleted || 0) / 10), 10);
    equity = penaltyPer10;
    score = Math.max(0, Math.round(proximity + need + verification - equity));
    return { score, proximity, need, verification, equity,
      daysSince: profile.lastWorkedDate
        ? Math.floor((Date.now() - new Date(profile.lastWorkedDate).getTime()) / (1000 * 60 * 60 * 24))
        : null };
  })();

  return (
    <div className="dashboard-page">

      {/* ── Header ── */}
      <header className="dashboard-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div className="brand-icon" style={{ width: 36, height: 36, fontSize: '1rem' }}>🔗</div>
          <span className="dashboard-title">FairConnect</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {!profileLoading && profile && (
            profile.isVerified
              ? <span className="badge-verified">✓ Verified</span>
              : <span className="badge-pending">⏳ Pending</span>
          )}
          <span className="role-badge worker">Worker</span>
          <button id="worker-logout-btn" className="btn-logout" onClick={handleLogout}>Sign Out</button>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="dashboard-hero" style={{ marginBottom: '2rem' }}>
        <div className="dashboard-hero-icon">👷</div>
        <h1>Welcome, {profile?.name || user?.name || 'Worker'}!</h1>
        <p>
          You&apos;re now logged in as a <strong>Worker</strong>. Explore job listings,
          track your applications, and connect with employers — all in one place.
        </p>

        {/* Skill pills + Edit button */}
        {!profileLoading && profile?.skills && profile.skills.length > 0 && (
          <div style={{ marginTop: '1rem' }}>
            <div className="skill-pills">
              {profile.skills.map((skill) => (
                <span
                  key={skill}
                  className={`skill-pill ${skill === profile.primarySkill ? 'primary' : ''}`}
                >
                  {skill === profile.primarySkill ? '⭐ ' : ''}{skill}
                </span>
              ))}
            </div>
            <button
              id="edit-skills-btn"
              className="btn-edit-skills"
              onClick={() => setShowEditSkills(true)}
            >
              ✏️ Edit Skills
            </button>
          </div>
        )}

        {/* Stat cards */}
        <div style={{ marginTop: '2rem', display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <StatCard icon="💼" label="Available Jobs" value={jobsLoading ? '…' : jobs.length} color="var(--clr-worker)" />
          <StatCard icon="📋" label="My Applications" value="3" color="var(--clr-secondary)" />
          <StatCard
            icon="⭐"
            label="Profile Score"
            value={
              profileLoading ? '…' :
              profile?.isVerified && profile?.skills?.length > 0 ? '100%' :
              profile?.isVerified || profile?.skills?.length > 0 ? '60%' : '20%'
            }
            color="var(--clr-primary)"
          />
        </div>

        {/* Complete profile CTA */}
        {profileIncomplete && (
          <button
            id="complete-profile-btn"
            className="prompt-card"
            onClick={() => navigate('/worker/complete-profile')}
            style={{ border: 'none', width: '100%', maxWidth: 560, margin: '1.5rem auto 0' }}
          >
            <div className="prompt-card-text" style={{ textAlign: 'left' }}>
              <h3>🚀 Complete Your Profile</h3>
              <p>Add your skills and upload an ID to unlock job opportunities and get a Verified badge.</p>
            </div>
            <span className="prompt-card-arrow">→</span>
          </button>
        )}
      </section>

      {/* ── Fairness Profile Card ── */}
      {!profileLoading && profile && fairnessEstimate && (
        <div className="fairness-profile-card">
          <div className="fpc-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div className="fpc-icon">⚖️</div>
              <div>
                <div className="fpc-title">My Fairness Profile</div>
                <div className="fpc-subtitle">How the Fairness Engine currently scores you</div>
              </div>
            </div>
            <div className="fpc-score-bubble"
              style={{
                background: fairnessEstimate.score >= 60
                  ? 'linear-gradient(135deg,#34d399,#059669)'
                  : fairnessEstimate.score >= 35
                  ? 'linear-gradient(135deg,#f59e0b,#d97706)'
                  : 'linear-gradient(135deg,#6366f1,#4f46e5)',
              }}
            >
              <div className="fpc-score-num">{fairnessEstimate.score}</div>
              <div className="fpc-score-label">/ 70 pts*</div>
            </div>
          </div>

          <div className="fpc-breakdown">
            {/* Proximity */}
            <div className="fpc-row">
              <div className="fpc-row-left">
                <span className="fpc-row-icon">📍</span>
                <div>
                  <div className="fpc-row-name">Proximity</div>
                  <div className="fpc-row-desc">
                    {profile.city
                      ? `City set: "${profile.city}" — +30 pts when job is in your city`
                      : 'No city set — set your city in profile for up to +30 pts'}
                  </div>
                </div>
              </div>
              <span className="fpc-badge" style={{ background: profile.city ? 'rgba(99,102,241,0.2)' : 'rgba(100,116,139,0.2)', color: profile.city ? '#a5b4fc' : '#94a3b8' }}>
                {profile.city ? 'Up to +30' : '0 pts'}
              </span>
            </div>

            {/* Need */}
            <div className="fpc-row">
              <div className="fpc-row-left">
                <span className="fpc-row-icon">⏳</span>
                <div>
                  <div className="fpc-row-name">Time Since Last Job</div>
                  <div className="fpc-row-desc">
                    {fairnessEstimate.daysSince === null
                      ? 'No jobs completed yet — you get the maximum need score'
                      : `${fairnessEstimate.daysSince} day${fairnessEstimate.daysSince !== 1 ? 's' : ''} idle — each day idle = +1 pt (max 50)`}
                  </div>
                </div>
              </div>
              <span className="fpc-badge" style={{ background: 'rgba(34,211,238,0.15)', color: '#22d3ee' }}>
                +{fairnessEstimate.need} pts
              </span>
            </div>

            {/* Verification */}
            <div className="fpc-row">
              <div className="fpc-row-left">
                <span className="fpc-row-icon">{profile.isVerified ? '✅' : '🔴'}</span>
                <div>
                  <div className="fpc-row-name">ID Verification</div>
                  <div className="fpc-row-desc">
                    {profile.isVerified
                      ? 'Verified — you earn the full +20 pts bonus'
                      : 'Not verified — upload your ID to earn +20 pts'}
                  </div>
                </div>
              </div>
              <span className="fpc-badge" style={{ background: profile.isVerified ? 'rgba(52,211,153,0.15)' : 'rgba(244,63,94,0.15)', color: profile.isVerified ? '#34d399' : '#f43f5e' }}>
                {profile.isVerified ? '+20 pts' : '0 pts'}
              </span>
            </div>

            {/* Equity */}
            <div className="fpc-row">
              <div className="fpc-row-left">
                <span className="fpc-row-icon">🏆</span>
                <div>
                  <div className="fpc-row-name">Equity Adjustment</div>
                  <div className="fpc-row-desc">
                    {profile.totalJobsCompleted || 0} jobs completed · −1 pt per 10 jobs (max −10) to help newcomers
                  </div>
                </div>
              </div>
              <span className="fpc-badge" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>
                {fairnessEstimate.equity > 0 ? `−${fairnessEstimate.equity} pts` : '0 pts'}
              </span>
            </div>
          </div>

          <div className="fpc-footer">
            * Score shown excludes proximity (+30) since it depends on each job&apos;s city.
            Your total can reach up to 100 pts for local jobs.
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          JOB FEED
      ══════════════════════════════════════════════════════════════════ */}
      <div className="job-feed-section">
        {/* Feed header */}
        <div className="job-feed-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div className="section-icon" style={{ width: 36, height: 36, fontSize: '1rem' }}>🔍</div>
            <div>
              <div className="section-title">Open Job Listings</div>
              <div className="section-subtitle">
                {jobsLoading ? 'Loading…' : `${filteredJobs.length} job${filteredJobs.length !== 1 ? 's' : ''} available`}
              </div>
            </div>
          </div>
          <button
            id="refresh-jobs-btn"
            className="btn-refresh"
            onClick={() => { setJobsLoading(true); fetchJobs(); }}
            disabled={jobsLoading}
          >
            {jobsLoading ? '…' : '↻ Refresh'}
          </button>
        </div>

        {/* Skill filter chips */}
        {!jobsLoading && feedSkillIds.length > 0 && (
          <div className="feed-filter-bar">
            <button
              className={`feed-filter-chip ${skillFilter === 'all' ? 'active' : ''}`}
              onClick={() => setSkillFilter('all')}
            >
              All
            </button>
            {feedSkillIds.map((sid) => {
              const s = SKILLS.find((sk) => sk.id === sid);
              return s ? (
                <button
                  key={sid}
                  className={`feed-filter-chip ${skillFilter === sid ? 'active' : ''}`}
                  onClick={() => setSkillFilter(sid)}
                >
                  {s.icon} {s.label}
                </button>
              ) : null;
            })}
          </div>
        )}

        {/* Content */}
        {jobsLoading ? (
          <div className="job-feed">
            {[1, 2, 3].map((n) => <div key={n} className="shimmer-card" />)}
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="jobs-empty">
            <div className="jobs-empty-icon">{skillFilter !== 'all' ? '🔎' : '📭'}</div>
            <p>
              {skillFilter !== 'all'
                ? `No open jobs for "${SKILLS.find(s => s.id === skillFilter)?.label}" right now.`
                : 'No open jobs at the moment. Check back soon!'}
            </p>
          </div>
        ) : (
          <div className="job-feed">
            {filteredJobs.map((job, i) => (
              <JobCard key={job._id} job={job} index={i} fairnessScore={job.fairnessScore} isSkillMatch={job.isSkillMatch} />
            ))}
          </div>
        )}
      </div>

      {/* ── Edit Skills Modal ── */}
      {showEditSkills && (
        <EditSkillsModal
          token={token}
          currentSkills={profile?.skills || []}
          onClose={() => setShowEditSkills(false)}
          onSaved={(updated) => {
            setProfile((prev) => ({ ...prev, ...updated }));
            setShowEditSkills(false);
          }}
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




// ── EditSkillsModal ───────────────────────────────────────────────────────────
function EditSkillsModal({ token, currentSkills, onClose, onSaved }) {
  const [selected, setSelected] = useState([...currentSkills]);
  const [saving,   setSaving]   = useState(false);
  const [msg,      setMsg]      = useState(null);

  const toggle = (id) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
    setMsg(null);
  };

  const handleSave = async () => {
    if (selected.length === 0) { setMsg({ type: 'error', text: 'Select at least one skill.' }); return; }
    if (selected.length > 10)  { setMsg({ type: 'error', text: 'Maximum 10 skills.' }); return; }
    setSaving(true); setMsg(null);
    try {
      const res = await fetch(`${API}/api/worker/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ skills: selected, primarySkill: selected[0] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setMsg({ type: 'success', text: '✅ Skills updated!' });
      setTimeout(() => onSaved({ skills: data.skills, primarySkill: data.primarySkill }), 900);
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'Failed to save.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()} role="dialog" aria-modal="true">
      <div className="modal-box">
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div className="section-icon" style={{ width: 36, height: 36, fontSize: '1rem' }}>🛠️</div>
            <div>
              <div className="section-title">Edit Your Skills</div>
              <div className="section-subtitle">Select up to 10 · first = primary</div>
            </div>
          </div>
          <button id="close-edit-skills-btn" className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="skill-grid modal-skill-grid" role="group">
          {SKILLS.map((skill) => (
            <button
              key={skill.id}
              id={`edit-skill-tile-${skill.id}`}
              className={`skill-tile ${selected.includes(skill.id) ? 'selected' : ''}`}
              onClick={() => toggle(skill.id)}
              aria-pressed={selected.includes(skill.id)}
              type="button"
            >
              <div className="skill-tile-icon">{skill.icon}</div>
              <div className="skill-tile-label">{skill.label}</div>
            </button>
          ))}
        </div>

        <p className="modal-selection-info">
          {selected.length === 0 ? 'No skills selected' : (
            <><strong style={{ color: '#a5b4fc' }}>{selected.length}</strong>
            {` skill${selected.length > 1 ? 's' : ''} selected`}
            {selected.length > 0 && <> · Primary: <strong style={{ color: '#22d3ee' }}>{SKILLS.find((s) => s.id === selected[0])?.label}</strong></>}
            </>
          )}
        </p>

        {msg && (
          <div className={`alert ${msg.type === 'error' ? 'alert-error' : 'alert-success'}`}>
            <span>{msg.type === 'error' ? '⚠️' : '✅'}</span>{msg.text}
          </div>
        )}

        <div className="modal-footer">
          <button id="cancel-edit-skills-btn" className="btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button id="save-edited-skills-btn" className="btn-primary" onClick={handleSave}
            disabled={saving || selected.length === 0} style={{ maxWidth: 200, marginTop: 0 }}>
            {saving ? <><span className="btn-spinner" />Saving…</> : 'Save Skills →'}
          </button>
        </div>
      </div>
    </div>
  );
}
