import React, { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet's default marker icon paths in bundlers (Vite/Webpack)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Aliases for trade skill matching
export const SKILL_ALIASES = {
  plumbing:     ['plumbing', 'plumber'],
  plumber:      ['plumbing', 'plumber'],
  electrical:   ['electrical', 'electrician'],
  electrician:  ['electrical', 'electrician'],
  masonry:      ['masonry', 'masonary', 'construction'],
  masonary:     ['masonry', 'masonary', 'construction'],
  construction: ['masonry', 'masonary', 'construction'],
};

// Helper to determine normalized skill for a job
export const resolveJobSkill = (job) => {
  if (job?.requiredSkill) {
    const s = String(job.requiredSkill).toLowerCase().trim();
    if (s.includes('plumb')) return 'plumbing';
    if (s.includes('electr')) return 'electrician';
    if (s.includes('mason') || s.includes('construct')) return 'masonry';
    return s;
  }
  if (job?.category) {
    const cat = String(job.category).toLowerCase();
    if (cat.includes('plumb')) return 'plumbing';
    if (cat.includes('electr')) return 'electrician';
    if (cat.includes('mason') || cat.includes('construct')) return 'masonry';
  }
  if (Array.isArray(job?.skillsRequired) && job.skillsRequired.length > 0) {
    for (const sk of job.skillsRequired) {
      const s = String(sk).toLowerCase();
      if (s.includes('plumb')) return 'plumbing';
      if (s.includes('electr')) return 'electrician';
      if (s.includes('mason') || s.includes('construct')) return 'masonry';
    }
  }
  if (job?.title) {
    const t = String(job.title).toLowerCase();
    if (t.includes('plumb')) return 'plumbing';
    if (t.includes('electr')) return 'electrician';
    if (t.includes('mason') || t.includes('construct')) return 'masonry';
  }
  return null;
};

// Helper to check if a worker has the required skill
export const checkSkillMatch = (job, workerSkills = []) => {
  const reqSkill = resolveJobSkill(job);
  // If no skill required, anyone can apply
  if (!reqSkill) return { canApply: true, requiredSkill: null };

  if (!workerSkills || workerSkills.length === 0) {
    return { canApply: false, requiredSkill: reqSkill };
  }

  const accepted = SKILL_ALIASES[reqSkill.toLowerCase()] || [reqSkill.toLowerCase()];
  const canApply = workerSkills.some((ws) => {
    const wsLower = String(ws).toLowerCase().trim();
    const workerAliases = SKILL_ALIASES[wsLower] || [wsLower];
    return accepted.some((acc) => workerAliases.includes(acc));
  });

  return { canApply, requiredSkill: reqSkill };
};

// Custom crisp SVG pin icon for jobs (green for skill-match, slate for locked)
const createJobPinIcon = (isMatch = true) => {
  const bg = isMatch ? '#10b981' : '#64748b';
  const shadow = isMatch ? 'rgba(16, 185, 129, 0.4)' : 'rgba(100, 116, 139, 0.3)';
  const icon = isMatch ? '📍' : '🔒';
  return L.divIcon({
    className: 'job-map-marker-pin',
    html: `
      <div style="
        width: 32px;
        height: 32px;
        background: ${bg};
        border: 2.5px solid #ffffff;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 10px ${shadow}, 0 2px 4px rgba(0,0,0,0.2);
        cursor: pointer;
        transition: transform 0.2s ease;
      ">
        <span style="
          transform: rotate(45deg);
          font-size: ${isMatch ? '14px' : '13px'};
          line-height: 1;
        ">${icon}</span>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });
};

// Custom marker for worker/user location
const createUserPinIcon = () => {
  return L.divIcon({
    className: 'user-map-marker-pin',
    html: `
      <div style="
        width: 22px;
        height: 22px;
        background: #2563eb;
        border: 3px solid #ffffff;
        border-radius: 50%;
        box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.3), 0 2px 6px rgba(0,0,0,0.3);
      "></div>
    `,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -11],
  });
};

// Component to dynamically re-center map and smoothly animate whenever userLocation changes
export function RecenterMap({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center && Array.isArray(center) && center.length === 2 && !isNaN(center[0]) && !isNaN(center[1])) {
      // Smooth animated fly-to transition to new center
      map.flyTo(center, Math.max(map.getZoom(), 12), {
        duration: 1.2,
        easeLinearity: 0.25,
      });
    }
  }, [center, map]);
  return null;
}

// Backwards compatibility alias
const MapRecenter = RecenterMap;

/**
 * JobMap Component
 * 
 * Interactive visual job map using Leaflet (react-leaflet).
 * Displays job postings as pins on a map centered around the worker's location
 * or Kolhapur default (16.70, 74.24).
 * 
 * @param {Object} props
 * @param {Array} props.jobs - Array of job objects with GeoJSON location: { type: 'Point', coordinates: [lng, lat] }
 * @param {Object} [props.userLocation] - Optional worker location: { lat, lng } or { latitude, longitude }
 * @param {function} [props.onApply] - Optional callback function called when "Apply Now" is clicked
 * @param {string} [props.token] - Optional JWT auth token for applying directly
 * @param {string} [props.className] - Optional custom CSS classes (e.g. "h-[400px] w-full rounded-lg")
 * @param {string} [props.height] - Optional explicit container height (e.g. "400px")
 * @param {number} [props.zoom=13] - Initial map zoom level
 * @param {Array} [props.workerSkills] - Worker skills array for skill-matching
 * @param {Set|Array} [props.appliedJobIds] - Already applied job IDs
 */
export default function JobMap({
  jobs = [],
  userLocation = null,
  onApply = null,
  token = null,
  className = 'h-[400px] w-full rounded-lg',
  height = '400px',
  zoom = 13,
  workerSkills = [],
  appliedJobIds: externalAppliedJobIds = null,
}) {
  const [applyingJobId, setApplyingJobId] = useState(null);
  const [appliedJobIds, setAppliedJobIds] = useState(() => {
    if (externalAppliedJobIds instanceof Set) return new Set(externalAppliedJobIds);
    if (Array.isArray(externalAppliedJobIds)) return new Set(externalAppliedJobIds);
    return new Set();
  });
  const [applyError, setApplyError] = useState({});

  // Sync external applied job IDs
  useEffect(() => {
    if (externalAppliedJobIds) {
      if (externalAppliedJobIds instanceof Set) {
        setAppliedJobIds(new Set(externalAppliedJobIds));
      } else if (Array.isArray(externalAppliedJobIds)) {
        setAppliedJobIds(new Set(externalAppliedJobIds));
      }
    }
  }, [externalAppliedJobIds]);

  // Resolve center: user location or default Kolhapur coordinates (16.70, 74.24)
  const center = useMemo(() => {
    if (userLocation) {
      const lat = userLocation.lat ?? userLocation.latitude;
      const lng = userLocation.lng ?? userLocation.longitude;
      if (lat != null && lng != null && !isNaN(lat) && !isNaN(lng)) {
        return [Number(lat), Number(lng)];
      }
    }
    // Kolhapur default coordinates: (16.70, 74.24)
    return [16.70, 74.24];
  }, [userLocation]);

  // Handle job application from map popup
  const handleApply = async (job) => {
    if (!job?._id) return;

    // Check skill match before proceeding
    const { canApply, requiredSkill } = checkSkillMatch(job, workerSkills);
    if (!canApply) {
      setApplyError((prev) => ({
        ...prev,
        [job._id]: `You need ${requiredSkill} skill to apply.`,
      }));
      return;
    }

    if (onApply && !token) {
      onApply(job);
      setAppliedJobIds((prev) => new Set([...prev, job._id]));
      return;
    }

    setApplyingJobId(job._id);
    setApplyError((prev) => ({ ...prev, [job._id]: null }));

    try {
      if (token) {
        const res = await fetch(`http://localhost:5000/api/applications/apply/${job._id}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Application failed');
      }

      setAppliedJobIds((prev) => new Set([...prev, job._id]));
      if (onApply) onApply(job);
    } catch (err) {
      if (err.message?.includes('already applied')) {
        setAppliedJobIds((prev) => new Set([...prev, job._id]));
      } else {
        setApplyError((prev) => ({ ...prev, [job._id]: err.message || 'Failed to apply' }));
      }
    } finally {
      setApplyingJobId(null);
    }
  };

  // Filter and convert valid jobs with coordinates
  const validJobsWithCoords = useMemo(() => {
    return jobs.map((job) => {
      if (!job) return null;

      // Extract coordinates from GeoJSON location: { coordinates: [lng, lat] }
      let coords = null;
      if (job.location?.coordinates && Array.isArray(job.location.coordinates) && job.location.coordinates.length >= 2) {
        const [lng, lat] = job.location.coordinates;
        if (!isNaN(lat) && !isNaN(lng)) {
          // Convert GeoJSON [lng, lat] to Leaflet [lat, lng]
          coords = [Number(lat), Number(lng)];
        }
      } else if (job.latitude != null && job.longitude != null) {
        coords = [Number(job.latitude), Number(job.longitude)];
      }

      if (!coords) return null;

      const { canApply, requiredSkill } = checkSkillMatch(job, workerSkills);

      return {
        ...job,
        leafletPosition: coords,
        isSkillMatch: canApply,
        resolvedSkill: requiredSkill,
      };
    }).filter(Boolean);
  }, [jobs, workerSkills]);

  const matchJobIcon = useMemo(() => createJobPinIcon(true), []);
  const lockedJobIcon = useMemo(() => createJobPinIcon(false), []);
  const userPinIcon = useMemo(() => createUserPinIcon(), []);

  return (
    <div
      className={`job-map-container ${className || ''}`}
      style={{
        height: height || '400px',
        width: '100%',
        position: 'relative',
        borderRadius: '12px',
        overflow: 'hidden',
        border: '1px solid #cbd5e1',
        boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)',
        zIndex: 0,
      }}
    >
      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom={false}
        style={{ height: '100%', width: '100%' }}
      >
        <RecenterMap center={center} />

        {/* Standard OpenStreetMap Tiles */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* User / Worker Location Marker */}
        {center && (
          <Marker position={center} icon={userPinIcon}>
            <Popup>
              <div style={{ textAlign: 'center', padding: '2px' }}>
                <span style={{ fontWeight: 700, color: '#1e3a8a', fontSize: '0.85rem' }}>
                  📍 {userLocation?.name ? userLocation.name : 'Search Location'}
                </span>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  {center[0].toFixed(4)}° N, {center[1].toFixed(4)}° E
                </div>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Job Pins and Popups */}
        {validJobsWithCoords.map((job) => {
          const isApplied = Boolean(
            appliedJobIds && (
              appliedJobIds instanceof Set
                ? (appliedJobIds.has(job._id) || appliedJobIds.has(String(job._id)))
                : Array.isArray(appliedJobIds) && appliedJobIds.some((id) => String(id) === String(job._id))
            )
          );
          const isApplying = applyingJobId === job._id;
          const errorMsg = applyError[job._id];

          // Format wage
          const wageDisplay = job.dailyWage ? `₹${job.dailyWage}/day` : '₹600/day';

          // Format distance
          const distanceVal = job.distance != null ? job.distance : job.distanceInKm;
          const distanceText = distanceVal != null ? `${distanceVal} km away` : (job.city ? `${job.city}` : null);

          return (
            <Marker
              key={job._id || `${job.leafletPosition[0]}-${job.leafletPosition[1]}`}
              position={job.leafletPosition}
              icon={job.isSkillMatch ? matchJobIcon : lockedJobIcon}
            >
              <Popup className="job-map-popup">
                <div style={{ minWidth: '190px', maxWidth: '250px', padding: '2px' }}>
                  {/* Job Title: Medium-weight dark text */}
                  <h4
                    className="font-medium text-slate-900 text-base mb-1"
                    style={{
                      margin: '0 0 4px 0',
                      fontWeight: 600,
                      color: '#0f172a',
                      fontSize: '0.95rem',
                      lineHeight: 1.3,
                    }}
                  >
                    {job.title}
                  </h4>

                  {/* Daily Wage: Bold, standard format */}
                  <div
                    className="font-bold text-slate-800 text-sm mb-1"
                    style={{
                      margin: '0 0 6px 0',
                      fontWeight: 700,
                      color: '#1e293b',
                      fontSize: '0.9rem',
                    }}
                  >
                    {wageDisplay}
                  </div>

                  {/* Distance Tag (if available) */}
                  {distanceText && (
                    <div
                      className="text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full inline-block mb-2 font-semibold"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: '#047857',
                        backgroundColor: '#ecfdf5',
                        border: '1px solid #a7f3d0',
                        borderRadius: '9999px',
                        padding: '2px 8px',
                        marginBottom: '8px',
                      }}
                    >
                      <span>📍</span> {distanceText}
                    </div>
                  )}

                  {/* Skill Badge with match status */}
                  {(job.resolvedSkill || job.requiredSkill) && (
                    <div
                      style={{
                        fontSize: '0.74rem',
                        color: '#475569',
                        marginBottom: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '4px',
                      }}
                    >
                      <span>Skill: <strong style={{ textTransform: 'capitalize' }}>{job.resolvedSkill || job.requiredSkill}</strong></span>
                      {job.isSkillMatch ? (
                        <span style={{
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          color: '#047857',
                          backgroundColor: '#ecfdf5',
                          border: '1px solid #a7f3d0',
                          padding: '1px 6px',
                          borderRadius: '4px',
                        }}>
                          ✨ Skill Match
                        </span>
                      ) : (
                        <span style={{
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          color: '#b91c1c',
                          backgroundColor: '#fef2f2',
                          border: '1px solid #fecaca',
                          padding: '1px 6px',
                          borderRadius: '4px',
                        }}>
                          🔒 Locked
                        </span>
                      )}
                    </div>
                  )}

                  {/* Error notice if application fails */}
                  {errorMsg && (
                    <div
                      style={{
                        color: '#dc2626',
                        fontSize: '0.72rem',
                        marginBottom: '6px',
                      }}
                    >
                      {errorMsg}
                    </div>
                  )}

                  {/* Skill-gate: only show Apply if worker has required skill */}
                  {isApplied ? (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.35rem',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      background: 'rgba(16, 185, 129, 0.1)',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      color: '#047857',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      width: '100%',
                      boxSizing: 'border-box',
                    }}>
                      ✓ Applied
                    </div>
                  ) : !job.isSkillMatch ? (
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.2rem',
                      padding: '6px 10px',
                      borderRadius: '6px',
                      background: 'rgba(239, 68, 68, 0.06)',
                      border: '1px solid rgba(239, 68, 68, 0.25)',
                      color: '#b91c1c',
                      fontSize: '0.76rem',
                      fontWeight: 600,
                      width: '100%',
                      boxSizing: 'border-box',
                      textAlign: 'center',
                    }}>
                      <div>
                        🔒 Requires <span style={{ textTransform: 'capitalize', fontWeight: 700 }}>{job.resolvedSkill || job.requiredSkill}</span> skill
                      </div>
                      {workerSkills.length > 0 && (
                        <div style={{ fontSize: '0.68rem', color: '#991b1b', opacity: 0.85 }}>
                          (Your skills: {workerSkills.join(', ')})
                        </div>
                      )}
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="bg-blue-600 text-white rounded-md py-1.5 px-3 text-sm font-semibold hover:bg-blue-700 transition w-full"
                      style={{
                        width: '100%',
                        backgroundColor: '#2563eb',
                        color: '#ffffff',
                        borderRadius: '6px',
                        padding: '6px 12px',
                        fontSize: '0.825rem',
                        fontWeight: 600,
                        border: 'none',
                        cursor: isApplying ? 'default' : 'pointer',
                        transition: 'background-color 0.15s ease',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                      }}
                      onClick={() => !isApplying && handleApply(job)}
                      disabled={isApplying}
                    >
                      {isApplying ? 'Applying...' : 'Apply Now'}
                    </button>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Map Badge Overlay (Total pins indicator) */}
      <div
        style={{
          position: 'absolute',
          top: '12px',
          right: '12px',
          zIndex: 400,
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(4px)',
          border: '1px solid #cbd5e1',
          padding: '4px 10px',
          borderRadius: '8px',
          fontSize: '0.75rem',
          fontWeight: 700,
          color: '#334155',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
        }}
      >
        <span>🗺️</span> {validJobsWithCoords.length} {validJobsWithCoords.length === 1 ? 'Job Pin' : 'Job Pins'} on Map
      </div>
    </div>
  );
}
