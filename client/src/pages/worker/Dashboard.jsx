import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import JobCard from '../../components/JobCard';
import JobMap from '../../components/JobMap';
import WorkerFeed from '../../components/WorkerFeed';
import SkillCategoryFilter from '../../components/SkillCategoryFilter';
import ChatDrawer, { ChatButton, LockedChatHint, useChatUnreadCounts } from '../../components/ChatDrawer';
import DropdownMenu from '../../components/ui/DropdownMenu';
import SegmentedTabs from '../../components/ui/SegmentedTabs';
import StatChip from '../../components/ui/StatChip';
import FairnessDrawer, { computeFairness, MAX_PROFILE_SCORE } from '../../components/FairnessDrawer';
import API_BASE_URL from '../../config';

const API = API_BASE_URL;

// ── Skill catalogue ───────────────────────────────────────────────────────────
const SKILLS = [
  { id: 'plumbing',    label: 'Plumbing',    icon: '🔧' },
  { id: 'electrician', label: 'Electrician', icon: '⚡' },
  { id: 'masonry',     label: 'Masonry',     icon: '🧱' },
];

export default function WorkerDashboard() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();

  // ── Active tab ──────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('nearby'); // 'nearby' | 'jobs' | 'applications' | 'completed'
  const [appFilter, setAppFilter] = useState('all'); // 'all' | 'pending' | 'accepted' | 'offered' | 'completed'
  const [nearbyJobsCount, setNearbyJobsCount] = useState(null);

  // ── Map view toggle in jobs feed ───────────────────────────────────────────
  const [showJobMap, setShowJobMap] = useState(true);

  // ── Profile ────────────────────────────────────────────────────────────────
  const [profile,        setProfile]        = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);

  // ── Edit skills modal ──────────────────────────────────────────────────────
  const [showEditSkills, setShowEditSkills] = useState(false);

  // ── Fairness drawer ────────────────────────────────────────────────────────
  const [showFairness, setShowFairness] = useState(false);

  // ── Job feed ───────────────────────────────────────────────────────────────
  const [jobs,        setJobs]        = useState([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [skillFilter, setSkillFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('All Jobs');
  const [selectedTradeSkills, setSelectedTradeSkills] = useState([]);

  // ── My applications ────────────────────────────────────────────────────────
  const [applications,    setApplications]    = useState([]);
  const [appsLoading,     setAppsLoading]     = useState(false);
  const [appliedJobIds,   setAppliedJobIds]   = useState(new Set());
  const [respondingAppId, setRespondingAppId] = useState(null);
  const [respondMsg,      setRespondMsg]      = useState(null);

  // ── Chat drawer ────────────────────────────────────────────────────────────
  const [chatDrawer, setChatDrawer] = useState(null); // { applicationId, otherPartyName, isReadOnly }
  const unreadCounts = useChatUnreadCounts(token);

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

  // ── Fetch my applications ─────────────────────────────────────────────────
  const fetchApplications = useCallback(async () => {
    if (!token) return;
    setAppsLoading(true);
    try {
      const res = await fetch(`${API}/api/applications/my-applications`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      const apps = data.applications || [];
      setApplications(apps);
      // Build set of already-applied job IDs (both ObjectId and string representations)
      const ids = new Set();
      apps.forEach((a) => {
        if (a.job?._id) {
          ids.add(a.job._id);
          ids.add(String(a.job._id));
        }
      });
      setAppliedJobIds(ids);
    } catch {
      setApplications([]);
    } finally {
      setAppsLoading(false);
    }
  }, [token]);

  // Synchronized callback when worker applies from either JobMap or JobCard
  const handleJobApplied = useCallback((appliedItem) => {
    const jId = appliedItem?.job?._id || appliedItem?.job || appliedItem?._id;
    if (jId) {
      setAppliedJobIds((prev) => new Set([...prev, jId, String(jId)]));
    }
    fetchApplications();
  }, [fetchApplications]);

  // Worker accepts or rejects an employer request
  const handleRespondToOffer = async (appId, action) => {
    setRespondingAppId(appId);
    setRespondMsg(null);
    try {
      const res = await fetch(`${API}/api/applications/${appId}/respond`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setRespondMsg({
        type: action === 'accept' ? 'success' : 'info',
        text: data.message,
      });
      await fetchApplications();
      await fetchJobs();
    } catch (err) {
      setRespondMsg({
        type: 'error',
        text: err.message || 'Failed to respond to request.',
      });
    } finally {
      setRespondingAppId(null);
    }
  };


  useEffect(() => { fetchJobs(); }, [fetchJobs]);
  useEffect(() => { fetchApplications(); }, [fetchApplications]);

  const handleLogout = () => { logout(); navigate('/login', { replace: true }); };

  const profileIncomplete = !profileLoading && (!profile?.skills || profile.skills.length === 0);

  // ── Filtered jobs ──────────────────────────────────────────────────────────
  const filteredJobs = jobs.filter((job) => {
    // 1. Trade Category filter
    if (categoryFilter && categoryFilter !== 'All Jobs' && categoryFilter !== 'all') {
      const matchCat = job.category && job.category.toLowerCase().includes(categoryFilter.toLowerCase());
      const matchSkillFallback = job.requiredSkill && categoryFilter.toLowerCase().includes(job.requiredSkill.toLowerCase());
      if (!matchCat && !matchSkillFallback) return false;
    }

    // 2. Specialized sub-skills / tags filter
    if (selectedTradeSkills && selectedTradeSkills.length > 0) {
      const jobSkills = Array.isArray(job.skillsRequired)
        ? job.skillsRequired.map((s) => String(s).toLowerCase())
        : [];
      if (job.requiredSkill) jobSkills.push(job.requiredSkill.toLowerCase());

      const hasMatch = selectedTradeSkills.some((ts) =>
        jobSkills.some((js) => js.includes(ts.toLowerCase()) || ts.toLowerCase().includes(js))
      );
      if (!hasMatch) return false;
    }

    // 3. Legacy skill filter chip
    if (skillFilter !== 'all' && job.requiredSkill !== skillFilter) {
      return false;
    }

    return true;
  });

  // Skills that appear in the feed (for filter chips)
  const feedSkillIds = [...new Set(jobs.map((j) => j.requiredSkill))];

  // ── Fairness (prefer server data, fallback to formula) ─────────────────────
  const fairness = computeFairness(profile);

  // Helper to get application status for a specific job
  const getAppStatusForJob = (jobId) => {
    const app = applications.find((a) => a.job?._id === jobId || String(a.job?._id) === String(jobId));
    return app?.status || null;
  };

  // ── Application categories and counts ──────────────────────────────────────
  const completedApps = applications.filter((a) => a.status === 'completed');
  const pendingApps = applications.filter((a) => a.status === 'pending' && a.initiatedBy !== 'employer');
  const offeredApps = applications.filter((a) => a.status === 'offered' || (a.initiatedBy === 'employer' && a.status === 'pending'));
  const acceptedApps = applications.filter((a) => a.status === 'accepted');
  const completedCount = Math.max(completedApps.length, profile?.totalJobsCompleted || 0);

  // Filtered applications based on active appFilter
  const displayedApplications = applications.filter((app) => {
    if (appFilter === 'all') return true;
    if (appFilter === 'completed') return app.status === 'completed';
    if (appFilter === 'accepted') return app.status === 'accepted';
    if (appFilter === 'pending') return app.status === 'pending' && app.initiatedBy !== 'employer';
    if (appFilter === 'offered') return app.status === 'offered' || (app.initiatedBy === 'employer' && app.status === 'pending');
    return true;
  });

  // First name
  const fullName = profile?.name || user?.name || '';
  const firstName = fullName.split(' ')[0] || 'Worker';

  // Avatar initial
  const avatarInitial = (firstName[0] || 'W').toUpperCase();

  // ── Tab definitions ────────────────────────────────────────────────────────
  const workerTabs = [
    { id: 'nearby',       label: 'Nearby Jobs',   icon: '📍', count: nearbyJobsCount || null },
    { id: 'jobs',         label: 'All Jobs',       icon: '🔍', count: filteredJobs.length || null },
    { id: 'applications', label: 'Applications',   icon: '📋', count: applications.length || null },
    { id: 'completed',    label: 'Completed',      icon: '🏆', count: completedCount || null },
  ];

  return (
    <div className="fc-page">

      {/* ── Top bar ── */}
      <header className="fc-topbar">
        <div className="fc-brand">
          <div className="brand-icon" style={{ width: 32, height: 32, fontSize: '0.9rem' }}>🔗</div>
          FairConnect
        </div>
        <div className="fc-topbar-right">
          {/* Fairness chip */}
          {!profileLoading && profile && fairness && (
            <button
              id="open-fairness-btn"
              className="fc-fairness-chip"
              onClick={() => setShowFairness(true)}
              aria-label="Open My Fairness Profile"
            >
              ⚖️ <span className="fc-hide-sm">My Fairness  </span>
              {fairness.score} / {MAX_PROFILE_SCORE}
            </button>
          )}

          {/* Verified / Pending badge */}
          {!profileLoading && profile && (
            profile.isVerified
              ? <span className="badge-verified fc-hide-sm">✓ Verified</span>
              : <span className="badge-pending fc-hide-sm">⏳ Pending</span>
          )}

          {/* Avatar dropdown */}
          <DropdownMenu
            label="Worker account menu"
            align="right"
            trigger={<div className="fc-avatar">{avatarInitial}</div>}
            items={[
              { label: 'My Fairness Profile', icon: '⚖️', onClick: () => setShowFairness(true) },
              { label: 'Edit Skills',           icon: '✏️', onClick: () => setShowEditSkills(true) },
              { label: 'Complete Profile / Certificate', icon: '📄', onClick: () => navigate('/worker/complete-profile') },
              { label: 'Sign Out', icon: '🚪', danger: true, onClick: handleLogout },
            ]}
          />
        </div>
      </header>

      {/* ── Greeting row ── */}
      <div className="fc-greeting">
        <div>
          <h1>Welcome back, {firstName} 👋</h1>
          {!profileLoading && profile?.skills && profile.skills.length > 0 && (
            <div className="fc-skill-row">
              {profile.skills.map((skill) => (
                <span
                  key={skill}
                  className={`skill-pill${skill === profile.primarySkill ? ' primary' : ''}`}
                >
                  {skill === profile.primarySkill ? '⭐ ' : ''}{skill}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* KPI chips on the right */}
        <div className="fc-kpis" style={{ flexShrink: 0 }}>
          <StatChip
            icon="💼"
            label="Available Jobs"
            value={jobsLoading ? '…' : (activeTab === 'nearby' && nearbyJobsCount !== null ? nearbyJobsCount : filteredJobs.length)}
            tone="green"
            onClick={() => setActiveTab(activeTab === 'nearby' ? 'nearby' : 'jobs')}
          />
          <StatChip
            icon="📋"
            label="Applications"
            value={appsLoading ? '…' : applications.length}
            tone="indigo"
            onClick={() => { setAppFilter('all'); setActiveTab('applications'); }}
          />
          <StatChip
            icon="🏆"
            label="Completed"
            value={appsLoading ? '…' : completedCount}
            tone="amber"
            onClick={() => { setAppFilter('completed'); setActiveTab('completed'); }}
          />
        </div>
      </div>

      {/* ── Slim alerts ── */}
      <div className="fc-alerts">
        {offeredApps.length > 0 && (
          <div className="fc-alert fc-alert--warn">
            <span>📩 <strong>{offeredApps.length}</strong> job request{offeredApps.length !== 1 ? 's' : ''} waiting for you</span>
            <button
              id="view-requests-btn"
              className="fc-btn fc-btn--amber fc-btn--sm"
              onClick={() => { setAppFilter('offered'); setActiveTab('applications'); }}
            >
              View &amp; respond →
            </button>
          </div>
        )}
        {profileIncomplete && (
          <div className="fc-alert fc-alert--info">
            <span>🚀 Complete your profile to unlock job opportunities</span>
            <button
              id="complete-profile-btn"
              className="fc-btn fc-btn--ghost fc-btn--sm"
              onClick={() => navigate('/worker/complete-profile')}
            >
              Complete profile →
            </button>
          </div>
        )}
      </div>

      {/* ── Tab switcher ── */}
      <SegmentedTabs
        tabs={workerTabs}
        value={activeTab}
        onChange={(id) => {
          if (id === 'applications') setAppFilter('all');
          if (id === 'completed') setAppFilter('completed');
          setActiveTab(id);
        }}
        ariaLabel="Dashboard sections"
      />

      {/* ══════════════════════════════════════════════════════════════════
          TAB: NEARBY JOBS (RADIUS DISCOVERY WITH WORKER FEED & MAP)
      ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'nearby' && (
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 0' }}>
          <WorkerFeed
            token={token}
            onJobApplied={handleJobApplied}
            onJobsFetched={(nearbyJobs) => setNearbyJobsCount(nearbyJobs.length)}
            workerSkills={profile?.skills || user?.skills || []}
            appliedJobIds={appliedJobIds}
            initialLocation={
              profile?.location?.coordinates && profile.location.coordinates.length >= 2
                ? { lat: profile.location.coordinates[1], lng: profile.location.coordinates[0], name: profile.city || 'Kolhapur' }
                : { lat: 16.7050, lng: 74.2433, name: 'Kolhapur Central' }
            }
          />
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB: OPEN JOBS
      ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'jobs' && (
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button
                id="toggle-job-map-btn"
                type="button"
                className="btn-refresh"
                style={{
                  background: showJobMap ? '#ecfdf5' : '#ffffff',
                  color: showJobMap ? '#047857' : '#475569',
                  borderColor: showJobMap ? '#10b981' : '#cbd5e1',
                  fontWeight: 600,
                }}
                onClick={() => setShowJobMap(!showJobMap)}
                title="Toggle interactive map view"
              >
                🗺️ {showJobMap ? 'Hide Map' : 'Show Map'}
              </button>
              <button
                id="refresh-jobs-btn"
                className="btn-refresh"
                onClick={() => { setJobsLoading(true); fetchJobs(); }}
                disabled={jobsLoading}
              >
                {jobsLoading ? '…' : '↻ Refresh'}
              </button>
            </div>
          </div>

          {/* Trade Skill & Category Filter Component */}
          <div style={{ marginBottom: '1.25rem' }}>
            <SkillCategoryFilter
              selectedCategory={categoryFilter}
              selectedSkills={selectedTradeSkills}
              activeJobCount={filteredJobs.length}
              onFilterChange={({ category, skills: nextSkills }) => {
                setCategoryFilter(category);
                setSelectedTradeSkills(nextSkills);
              }}
            />
          </div>

          {/* Interactive Visual Job Map */}
          {!jobsLoading && showJobMap && (
            <div style={{ marginBottom: '1.25rem' }}>
              <JobMap
                jobs={filteredJobs}
                userLocation={
                  profile?.location?.coordinates && profile.location.coordinates.length >= 2
                    ? { lat: profile.location.coordinates[1], lng: profile.location.coordinates[0] }
                    : { lat: 16.70, lng: 74.24 }
                }
                token={token}
                onApply={handleJobApplied}
                workerSkills={profile?.skills || user?.skills || []}
                appliedJobIds={appliedJobIds}
                height="380px"
                className="h-[380px] w-full rounded-lg"
              />
            </div>
          )}

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
                <JobCard
                  key={job._id}
                  job={job}
                  index={i}
                  fairnessScore={job.fairnessScore}
                  isSkillMatch={job.isSkillMatch}
                  token={token}
                  applicationStatus={getAppStatusForJob(job._id)}
                  workerSkills={profile?.skills || user?.skills || []}
                  appliedJobIds={appliedJobIds}
                  onApply={handleJobApplied}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB: MY APPLICATIONS
      ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'applications' && (
        <div className="job-feed-section">
          <div className="job-feed-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div className="section-icon" style={{ width: 36, height: 36, fontSize: '1rem' }}>📋</div>
              <div>
                <div className="section-title">My Applications</div>
                <div className="section-subtitle">
                  {appsLoading ? 'Loading…' : `${displayedApplications.length} of ${applications.length} application${applications.length !== 1 ? 's' : ''} shown`}
                </div>
              </div>
            </div>
            <button
              id="refresh-applications-btn"
              className="btn-refresh"
              onClick={() => fetchApplications()}
              disabled={appsLoading}
            >
              {appsLoading ? '…' : '↻ Refresh'}
            </button>
          </div>

          {/* Status filter chips inside Applications tab */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.45rem',
            padding: '0.5rem 1rem 0.75rem',
            borderBottom: '1px solid var(--clr-border, #e2e8f0)',
          }}>
            {[
              { id: 'all', label: 'All Applications', count: applications.length },
              { id: 'pending', label: 'Pending Review', count: pendingApps.length },
              { id: 'accepted', label: 'Hired & Active', count: acceptedApps.length },
              { id: 'offered', label: 'Job Requests', count: offeredApps.length },
              { id: 'completed', label: 'Completed Jobs', count: completedApps.length },
            ].map((f) => (
              <button
                key={f.id}
                id={`app-filter-${f.id}`}
                onClick={() => setAppFilter(f.id)}
                style={{
                  padding: '0.35rem 0.85rem',
                  borderRadius: '9999px',
                  border: '1px solid',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 150ms',
                  borderColor: appFilter === f.id ? '#10b981' : 'var(--clr-border, #cbd5e1)',
                  background: appFilter === f.id ? '#ecfdf5' : 'transparent',
                  color: appFilter === f.id ? '#047857' : 'var(--clr-text-muted, #475569)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
              >
                <span>{f.label}</span>
                <span style={{
                  padding: '0.05rem 0.4rem',
                  borderRadius: '9999px',
                  background: appFilter === f.id ? '#10b981' : 'rgba(100, 116, 139, 0.15)',
                  color: appFilter === f.id ? '#ffffff' : '#64748b',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                }}>
                  {f.count}
                </span>
              </button>
            ))}
          </div>

          {respondMsg && (
            <div style={{
              margin: '0.75rem 1rem 0',
              padding: '0.75rem 1rem',
              borderRadius: 'var(--radius-md, 12px)',
              background: respondMsg.type === 'error' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
              border: `1px solid ${respondMsg.type === 'error' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
              color: respondMsg.type === 'error' ? '#ef4444' : '#10b981',
              fontSize: '0.88rem',
              fontWeight: 600,
            }}>
              {respondMsg.text}
            </div>
          )}

          {appsLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1rem' }}>
              {[1, 2, 3].map((n) => <div key={n} className="shimmer-card" style={{ height: 90 }} />)}
            </div>
          ) : displayedApplications.length === 0 ? (
            <div className="jobs-empty">
              <div className="jobs-empty-icon">{appFilter === 'completed' ? '🏆' : '📭'}</div>
              <p>
                {appFilter === 'all'
                  ? 'No applications or job requests yet. Browse open jobs and apply to get started!'
                  : `No applications found with status "${appFilter}".`}
              </p>
              {appFilter !== 'all' ? (
                <button
                  onClick={() => setAppFilter('all')}
                  style={{
                    marginTop: '0.75rem',
                    padding: '0.5rem 1.25rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#475569',
                    fontWeight: 600,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                  }}
                >
                  Clear Status Filter
                </button>
              ) : (
                <button
                  onClick={() => setActiveTab('jobs')}
                  style={{
                    marginTop: '1rem',
                    padding: '0.65rem 1.5rem',
                    borderRadius: 'var(--radius-md, 12px)',
                    border: 'none',
                    background: 'var(--grad-primary, linear-gradient(135deg, #10b981, #059669))',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                  }}
                >
                  🔍 Browse Jobs
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '0.75rem 1rem' }}>
              {displayedApplications.map((app) => (
                <ApplicationRow
                  key={app._id}
                  application={app}
                  responding={respondingAppId === app._id}
                  onRespond={(action) => handleRespondToOffer(app._id, action)}
                  unreadCount={unreadCounts[app._id] || 0}
                  onOpenChat={() => setChatDrawer({
                    applicationId: app._id,
                    otherPartyName: app.job?.employerId?.name || 'Customer',
                    isReadOnly: app.status === 'completed',
                  })}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB: COMPLETED JOBS (VERIFIED WORK HISTORY & CREDITS)
      ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'completed' && (
        <div className="job-feed-section">
          <div className="job-feed-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div className="section-icon" style={{ width: 36, height: 36, fontSize: '1rem', background: '#eef2ff', borderColor: '#c7d2fe' }}>🏆</div>
              <div>
                <div className="section-title">Completed Jobs &amp; Work History</div>
                <div className="section-subtitle">
                  {appsLoading ? 'Loading…' : `${completedCount} job${completedCount !== 1 ? 's' : ''} completed and verified`}
                </div>
              </div>
            </div>
            <button
              id="refresh-completed-btn"
              className="btn-refresh"
              onClick={() => fetchApplications()}
              disabled={appsLoading}
            >
              {appsLoading ? '…' : '↻ Refresh'}
            </button>
          </div>

          {/* Completed Jobs Summary Banner */}
          <div style={{
            margin: '0.75rem 1rem',
            padding: '1rem 1.25rem',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(16, 185, 129, 0.08))',
            border: '1px solid rgba(99, 102, 241, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
          }}>
            <div>
              <div style={{ fontWeight: 800, color: '#312e81', fontSize: '0.98rem' }}>
                🎉 Verified Completed Jobs Record
              </div>
              <div style={{ color: '#475569', fontSize: '0.84rem', marginTop: '2px' }}>
                Each completed job boosts your Fairness Engine ranking and establishes verified trust on the platform.
              </div>
            </div>
            <div style={{
              display: 'flex',
              gap: '1.25rem',
              alignItems: 'center',
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#4f46e5' }}>{completedCount}</div>
                <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Total Done</div>
              </div>
              <div style={{ width: '1px', height: '32px', background: '#cbd5e1' }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#10b981' }}>100%</div>
                <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Completion Rate</div>
              </div>
            </div>
          </div>

          {/* List of completed jobs */}
          {appsLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1rem' }}>
              {[1, 2].map((n) => <div key={n} className="shimmer-card" style={{ height: 90 }} />)}
            </div>
          ) : completedApps.length === 0 ? (
            <div className="jobs-empty">
              <div className="jobs-empty-icon">🏆</div>
              <p style={{ fontWeight: 600, color: '#0f172a', marginBottom: '0.25rem' }}>No completed jobs recorded yet</p>
              <p style={{ fontSize: '0.85rem', color: '#64748b', maxWidth: 440, margin: '0 auto' }}>
                Once a customer hires you and marks the job as complete, it will appear here along with your earnings, verification records, and chat transcripts.
              </p>
              <button
                onClick={() => setActiveTab('jobs')}
                style={{
                  marginTop: '1.25rem',
                  padding: '0.65rem 1.5rem',
                  borderRadius: 'var(--radius-md, 12px)',
                  border: 'none',
                  background: 'var(--grad-primary, linear-gradient(135deg, #10b981, #059669))',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                🔍 Explore Available Jobs
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '0.75rem 1rem' }}>
              {completedApps.map((app) => (
                <ApplicationRow
                  key={app._id}
                  application={app}
                  responding={false}
                  onRespond={() => {}}
                  unreadCount={unreadCounts[app._id] || 0}
                  onOpenChat={() => setChatDrawer({
                    applicationId: app._id,
                    otherPartyName: app.job?.employerId?.name || 'Customer',
                    isReadOnly: true,
                  })}
                />
              ))}
            </div>
          )}
        </div>
      )}

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

      {/* ── Fairness Drawer ── */}
      <FairnessDrawer
        open={showFairness}
        onClose={() => setShowFairness(false)}
        profile={profile}
      />

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

// ── ApplicationRow ────────────────────────────────────────────────────────────
function ApplicationRow({ application, responding, onRespond, unreadCount = 0, onOpenChat }) {
  const job = application.job;

  // Resolve skill even when requiredSkill uses an alias (e.g. 'plumber' → Plumbing tile)
  const SKILL_ALIAS_TO_ID = {
    plumber:      'plumbing',
    plumbing:     'plumbing',
    electrician:  'electrician',
    electrical:   'electrician',
    masonry:      'masonry',
    masonary:     'masonry',
    construction: 'masonry',
  };
  const resolvedSkillId = job?.requiredSkill
    ? (SKILL_ALIAS_TO_ID[job.requiredSkill.toLowerCase()] || job.requiredSkill.toLowerCase())
    : null;
  const skill = resolvedSkillId ? SKILLS.find((s) => s.id === resolvedSkillId) : null;
  const status = application.status;
  const isOffered = status === 'offered' || (application.initiatedBy === 'employer' && status === 'pending');
  const isChatEligible = status === 'accepted' || status === 'completed';

  const statusConfig = {
    offered:   { bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.45)', color: '#d97706', icon: '📩', label: 'Job Request from Customer' },
    pending:   { bg: 'rgba(245, 158, 11, 0.10)', border: 'rgba(245, 158, 11, 0.30)', color: '#b45309', icon: '⏳', label: 'Pending Review' },
    accepted:  { bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.45)', color: '#047857', icon: '✅', label: 'Hired & Assigned' },
    rejected:  { bg: 'rgba(239, 68, 68, 0.10)', border: 'rgba(239, 68, 68, 0.30)', color: '#b91c1c', icon: '❌', label: 'Not Selected' },
    completed: { bg: 'rgba(99, 102, 241, 0.10)', border: 'rgba(99, 102, 241, 0.30)', color: '#4338ca', icon: '🏆', label: 'Job Completed' },
  };
  const sc = isOffered ? statusConfig.offered : (statusConfig[status] || statusConfig.pending);

  // Safe date parse — appliedAt may be null for employer-initiated offers
  const dateVal = application.appliedAt || application.createdAt || application.updatedAt;
  const appliedDate = dateVal
    ? new Date(dateVal).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '1rem',
      padding: '1rem 1.25rem',
      background: 'var(--clr-bg-card, #ffffff)',
      border: '1px solid var(--clr-border, #e2e8f0)',
      borderRadius: 'var(--radius-md, 12px)',
      transition: 'all 150ms',
      flexWrap: 'wrap',
      borderLeft: `4px solid ${sc.border}`,
      boxShadow: isOffered ? '0 4px 16px rgba(245, 158, 11, 0.1)' : 'none',
    }}>
      <div style={{ flex: 1, minWidth: 260 }}>
        <div style={{
          fontSize: '0.96rem',
          fontWeight: 700,
          color: 'var(--clr-text-heading, #0f172a)',
          marginBottom: '0.35rem',
        }}>
          {job?.title || 'Unknown Job'}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.55rem', alignItems: 'center', fontSize: '0.8rem', color: 'var(--clr-text-muted, #475569)' }}>
          {skill && (
            <span style={{
              padding: '0.15rem 0.55rem',
              borderRadius: '9999px',
              background: 'var(--clr-bg-mid, #f1f5f9)',
              border: '1px solid var(--clr-border, #e2e8f0)',
              fontSize: '0.74rem',
              fontWeight: 600,
            }}>
              {skill.icon} {skill.label}
            </span>
          )}
          {job?.dailyWage && <span style={{ fontWeight: 700, color: '#0f172a' }}>₹{job.dailyWage}/day</span>}
          {job?.city && <span>📍 {job.city}</span>}
          <span style={{ color: 'var(--clr-text-faint, #94a3b8)' }}>{appliedDate}</span>
          {job?.employerId?.name && <span>👤 {job.employerId.name}</span>}
        </div>
      </div>

      {/* ── Status badge or Accept / Decline buttons ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        {isOffered ? (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              id={`accept-offer-${application._id}`}
              onClick={() => onRespond('accept')}
              disabled={responding}
              style={{
                padding: '0.55rem 1.1rem',
                borderRadius: 'var(--radius-md, 10px)',
                background: 'var(--grad-primary, linear-gradient(135deg, #10b981, #059669))',
                color: '#fff',
                fontWeight: 700,
                fontSize: '0.84rem',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
              }}
            >
              {responding ? 'Processing…' : '✅ Accept Job'}
            </button>
            <button
              id={`reject-offer-${application._id}`}
              onClick={() => onRespond('reject')}
              disabled={responding}
              style={{
                padding: '0.55rem 0.95rem',
                borderRadius: 'var(--radius-md, 10px)',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#ef4444',
                fontWeight: 700,
                fontSize: '0.84rem',
                cursor: 'pointer',
              }}
            >
              ❌ Decline
            </button>
          </div>
        ) : (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.4rem 0.9rem',
            borderRadius: '9999px',
            fontSize: '0.78rem',
            fontWeight: 700,
            background: sc.bg,
            border: `1px solid ${sc.border}`,
            color: sc.color,
            flexShrink: 0,
            letterSpacing: '0.01em',
          }}>
            {sc.icon} {sc.label}
          </span>
        )}

        {/* ── Chat / Contact gate ── */}
        {isChatEligible
          ? <ChatButton
              applicationId={application._id}
              unreadCount={unreadCount}
              onClick={onOpenChat}
            />
          : <LockedChatHint />
        }
      </div>
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
