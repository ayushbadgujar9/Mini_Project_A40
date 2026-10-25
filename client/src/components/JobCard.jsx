import { useState, useEffect } from 'react';
import { checkSkillMatch, resolveJobSkill } from './JobMap';

/**
 * JobCard Component (Clean Emerald / Mint Light Theme)
 * 
 * Reusable card for displaying job opportunities with a light, clean, and minimalistic aesthetic.
 * 
 * Accepts direct props (title, wage, distance, skill, isFairMatch) or a job object.
 * 
 * @param {Object} props
 * @param {string} [props.title] - Job position title
 * @param {string} [props.wage] - Wage display format (e.g., "₹600/day" or "$25/hr")
 * @param {string} [props.distance] - Distance to job site (e.g., "2.5 km away")
 * @param {string} [props.skill] - Required skill/category
 * @param {boolean} [props.isFairMatch] - Flag indicating if job is a fair match
 * @param {function} [props.onApply] - Optional callback function on Apply button click
 * @param {Object} [props.job] - Fallback job object (job.title, job.dailyWage, job.city, job.requiredSkill)
 * @param {number} [props.fairnessScore] - Fairness engine score for job object
 * @param {boolean} [props.isSkillMatch] - Skill match flag for job object
 * @param {string} [props.token] - Auth token for applying
 * @param {string} [props.applicationStatus] - Existing application status if already applied
 */
export default function JobCard({
  title,
  wage,
  distance,
  skill,
  isFairMatch,
  onApply,
  job,
  fairnessScore = 0,
  isSkillMatch = false,
  token,
  applicationStatus,
  workerSkills = [],
  appliedJobIds = null,
}) {
  const isAlreadyApplied = Boolean(
    applicationStatus ||
    (appliedJobIds && (
      appliedJobIds instanceof Set
        ? (appliedJobIds.has(job?._id) || appliedJobIds.has(String(job?._id)))
        : Array.isArray(appliedJobIds) && appliedJobIds.some((id) => String(id) === String(job?._id))
    ))
  );

  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(isAlreadyApplied);
  const [status, setStatus] = useState(applicationStatus || (isAlreadyApplied ? 'pending' : null));
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isAlreadyApplied) {
      setApplied(true);
      setStatus(applicationStatus || 'pending');
    }
  }, [isAlreadyApplied, applicationStatus]);

  // Resolve values from direct props or job object
  const displayTitle = title || job?.title || 'Masonry Worker Needed';
  const displayWage = wage || (job?.dailyWage ? `₹${job.dailyWage}/day` : '₹600/day');
  const displayDistance = distance 
    || (job?.distance != null ? `${job.distance} km away` : null)
    || (job?.distanceInKm != null ? `${job.distanceInKm} km away` : null)
    || (job?.city ? `${job.city}` : '2.5 km away');
  const displaySkill = skill || job?.requiredSkill || 'Masonry';
  const displayFairMatch = isFairMatch !== undefined 
    ? isFairMatch 
    : (isSkillMatch && fairnessScore >= 70);

  // ── Skill-match gate: worker must have the required skill to apply ──
  const { canApply, requiredSkill } = checkSkillMatch(job, workerSkills);

  const handleApply = async () => {
    // If custom onApply is provided without token, delegate to parent
    if (onApply && !token) {
      onApply(job);
      return;
    }

    if (!token || !job?._id) return;

    setApplying(true);
    setError(null);
    try {
      const res = await fetch(`http://localhost:5000/api/applications/apply/${job._id}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setApplied(true);
      setStatus('pending');
      if (onApply) onApply(job);
    } catch (err) {
      if (err.message?.includes('already applied')) {
        setApplied(true);
        setStatus('pending');
        if (onApply) onApply(job);
      } else {
        setError(err.message || 'Failed to apply.');
      }
    } finally {
      setApplying(false);
    }
  };

  // Status badge styling
  const getStatusBadge = () => {
    if (!applied || !status) return null;
    const configs = {
      pending:  { bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.3)', color: '#b45309', text: '⏳ Pending' },
      accepted: { bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.3)', color: '#047857', text: '✅ Accepted' },
      rejected: { bg: 'rgba(239, 68, 68, 0.12)', border: 'rgba(239, 68, 68, 0.3)', color: '#b91c1c', text: '❌ Rejected' },
      completed: { bg: 'rgba(99, 102, 241, 0.12)', border: 'rgba(99, 102, 241, 0.3)', color: '#4338ca', text: '🏆 Completed' },
    };
    const cfg = configs[status] || configs.pending;
    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.25rem',
        padding: '0.3rem 0.75rem',
        borderRadius: '9999px',
        fontSize: '0.73rem',
        fontWeight: 700,
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        color: cfg.color,
        letterSpacing: '0.01em',
      }}>
        {cfg.text}
      </span>
    );
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-5 flex flex-col justify-between w-full max-w-sm hover:border-emerald-300 shadow-sm transition-all">
      <div>
        {/* Header: Title & Optional Fairness Badge */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <h3 className="text-slate-800 text-lg font-medium leading-snug">
            {displayTitle}
          </h3>

          {/* Fairness Badge (Soft Mint/Emerald) */}
          {displayFairMatch && (
            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200/80 text-xs font-medium px-2.5 py-1 rounded shrink-0">
              Fair Match
            </span>
          )}
        </div>

        {/* Wage Display */}
        <div className="text-slate-900 font-semibold mb-4">
          {displayWage}
        </div>

        {/* Metadata: Distance & Skill */}
        <div className="flex items-center gap-4 text-slate-500 text-sm mb-6">
          {/* Distance with minimal Pin Icon */}
          <div className="flex items-center gap-1.5">
            <svg
              className="w-4 h-4 text-slate-400 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            <span className="capitalize">{displayDistance}</span>
          </div>

          {/* Skill with minimal Icon */}
          <div className="flex items-center gap-1.5">
            <svg
              className="w-4 h-4 text-slate-400 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
            <span className="capitalize">{displaySkill}</span>
          </div>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div style={{
          padding: '0.5rem 0.75rem',
          marginBottom: '0.5rem',
          borderRadius: '8px',
          fontSize: '0.78rem',
          background: 'rgba(239, 68, 68, 0.08)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          color: '#b91c1c',
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* Application status badge or Apply button */}
      {applied ? (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0.65rem',
          borderRadius: '8px',
          background: 'var(--clr-bg-mid, #f1f5f9)',
          border: '1px solid var(--clr-border, #e2e8f0)',
        }}>
          {getStatusBadge()}
        </div>
      ) : canApply ? (
        <button
          type="button"
          onClick={handleApply}
          disabled={applying}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-md py-3 text-base font-medium transition-colors disabled:opacity-60"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
        >
          {applying ? (
            <>
              <span style={{
                width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)',
                borderTopColor: '#fff', borderRadius: '50%',
                animation: 'spin 0.6s linear infinite', display: 'inline-block',
              }} />
              Applying…
            </>
          ) : 'Apply Now'}
        </button>
      ) : (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.2rem',
          padding: '0.65rem',
          borderRadius: '8px',
          background: 'rgba(239, 68, 68, 0.06)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          color: '#b91c1c',
          fontSize: '0.78rem',
          fontWeight: 600,
          textAlign: 'center',
        }}>
          <div>
            🔒 Requires <span style={{ textTransform: 'capitalize', fontWeight: 700 }}>{requiredSkill || displaySkill}</span> skill
          </div>
          {workerSkills.length > 0 && (
            <div style={{ fontSize: '0.7rem', color: '#991b1b', opacity: 0.85 }}>
              (Your skills: {workerSkills.join(', ')})
            </div>
          )}
        </div>
      )}
    </div>
  );
}
