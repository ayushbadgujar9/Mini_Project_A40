import { Drawer } from './ui/Overlay';

export const MAX_PROFILE_SCORE = 50;

export function fairnessTier(score) {
  if (score >= 40) return { label: 'Excellent', color: '#10b981', bg: 'rgba(16,185,129,0.12)' };
  if (score >= 25) return { label: 'Good',      color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' };
  return            { label: 'Building',  color: '#6366f1', bg: 'rgba(99,102,241,0.12)' };
}

export function computeFairness(profile) {
  if (!profile) return null;
  const fb = profile.fairnessBreakdown;
  const residency = fb?.residencyScore   ?? (profile.isLocal ? 15 : 0);
  const completedJobs = Number(profile.stats?.totalCompleted ?? profile.totalJobsCompleted ?? 0);
  const experience = fb?.experienceScore ?? Math.min(20, 10 + Math.max(0, completedJobs));
  const avgRating  = Number(profile.ratings?.average ?? 0);
  const feedback   = fb?.feedbackScore   ?? parseFloat(((Math.max(0, Math.min(5, avgRating)) / 5) * 5).toFixed(1));
  const isVerified  = Boolean(
    profile.isVerified ||
    profile.verificationStatus === 'verified' ||
    profile.certificate?.verifiedAt
  );
  const verification = fb?.verificationScore ?? (isVerified ? 10 : 0);
  const score = profile.fairnessScore ?? fb?.totalScore ??
    parseFloat((residency + experience + feedback + verification).toFixed(1));
  const ratingCount = Number(profile.ratings?.count ?? 0);
  const tier = fairnessTier(score);
  return { score, residency, experience, feedback, verification, completedJobs, averageRating: avgRating, ratingCount, isLocal: Boolean(profile.isLocal), isVerified, tier };
}

function ScoreBar({ value, max, color }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="fc-bar" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
      <div className="fc-bar-fill" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

export default function FairnessDrawer({ open, onClose, profile }) {
  const f = computeFairness(profile);
  if (!f) return null;

  const rows = [
    {
      icon: '📍', label: 'Local residency', pts: f.residency, max: 15,
      color: '#10b981',
      desc: f.isLocal ? 'Local resident — +15 pts awarded.' : 'Non-local status — set your city to earn +15 pts.',
    },
    {
      icon: '🔨', label: 'Experience & progression', pts: f.experience, max: 20,
      color: '#6366f1',
      desc: `10 base pts + 1 pt/job · ${f.completedJobs} completed · max 20 pts.`,
    },
    {
      icon: '⭐', label: 'Customer feedback', pts: f.feedback, max: 5,
      color: '#f59e0b',
      desc: f.averageRating > 0
        ? `Avg ${f.averageRating}★ from ${f.ratingCount} review${f.ratingCount !== 1 ? 's' : ''} · mapped up to 5 pts.`
        : 'No ratings yet — up to 5 pts from employer reviews.',
    },
    {
      icon: '✅', label: 'ID Verification', pts: f.verification, max: 10,
      color: '#10b981',
      desc: f.isVerified
        ? 'Identity verified — +10 pts awarded.'
        : 'Upload a government ID or ITI certificate to earn +10 pts.',
    },
  ];

  const tips = [];
  if (!f.isLocal) tips.push('Set your city to earn the +15 local residency pts.');
  if (f.experience < 20) tips.push(`Complete ${20 - f.experience} more job${20 - f.experience !== 1 ? 's' : ''} to reach the experience cap.`);
  if (f.ratingCount === 0) tips.push('Accept job requests so employers can rate you.');
  if (!f.isVerified) tips.push('Upload your government ID or ITI certificate to earn the +10 verification pts.');

  const pct = Math.round((f.score / MAX_PROFILE_SCORE) * 100);
  const summaryParts = [];
  if (f.completedJobs > 0) summaryParts.push(`${f.completedJobs} job${f.completedJobs !== 1 ? 's' : ''} completed`);
  if (f.averageRating > 0) summaryParts.push(`${f.averageRating}★ from ${f.ratingCount} review${f.ratingCount !== 1 ? 's' : ''}`);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="My Fairness Profile"
      subtitle="How the Fairness Engine currently scores you"
      icon="⚖️"
      id="fairness-drawer"
    >
      {/* Hero ring */}
      <div className="fc-fp-hero">
        <div
          className={`fc-ring fc-ring--${f.tier.label.toLowerCase()}`}
          style={{ '--pct': `${pct}%` }}
        >
          <div className="fc-ring-inner">
            <div className="fc-ring-score">{f.score}</div>
            <div className="fc-ring-max">of {MAX_PROFILE_SCORE}</div>
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <span className="fc-pill" style={{ background: f.tier.bg, color: f.tier.color }}>
            {f.tier.label}
          </span>
          {summaryParts.length > 0 && (
            <div style={{ fontSize: '0.8rem', color: 'var(--clr-text-muted)', marginTop: '0.5rem' }}>
              {summaryParts.join(' · ')}
            </div>
          )}
        </div>
      </div>

      {/* Breakdown */}
      <div className="fc-sec-title">Score breakdown</div>
      {rows.map((r) => (
        <div key={r.label} className="fc-fp-row">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.3rem' }}>
            <span style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--clr-text-heading)' }}>
              {r.icon} {r.label}
            </span>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: r.color }}>
              {r.pts} / {r.max} pts
            </span>
          </div>
          <ScoreBar value={r.pts} max={r.max} color={r.color} />
          <div style={{ fontSize: '0.76rem', color: 'var(--clr-text-muted)', marginTop: '0.3rem' }}>{r.desc}</div>
        </div>
      ))}

      {/* Tips */}
      {tips.length > 0 && (
        <>
          <div className="fc-sec-title" style={{ marginTop: '1.25rem' }}>How to improve</div>
          <ul className="fc-tips">
            {tips.map((tip, i) => <li key={i}>{tip}</li>)}
          </ul>
        </>
      )}

      <p className="fc-fine">
        * Your profile score (max {MAX_PROFILE_SCORE} pts: 15 local + 20 experience + 5 feedback + 10 verification) measures your standing on the platform. The per-job match score is calculated separately based on proximity, skill fit, and employer needs.
      </p>
    </Drawer>
  );
}