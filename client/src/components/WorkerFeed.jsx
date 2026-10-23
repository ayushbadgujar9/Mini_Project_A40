import React, { useState, useCallback } from 'react';
import NearbyJobFilter from './NearbyJobFilter';
import JobMap from './JobMap';

const DEFAULT_LOCATION = {
  lat: 16.7050,
  lng: 74.2433,
  name: 'Kolhapur Central',
};

/**
 * WorkerFeed Component
 * 
 * Top-level coordinator connecting:
 * 1. NearbyJobFilter (Dual search: OpenStreetMap Nominatim geocoding + browser GPS)
 * 2. JobMap (Leaflet interactive map with animated smooth re-centering)
 * 
 * Maintains synchronized top-level state for `jobs` and `userLocation`.
 * Whenever a new city or location is searched, both the map center and the job
 * results update in lockstep.
 * 
 * @param {Object} props
 * @param {string} [props.token] - Worker auth JWT token for applying to jobs
 * @param {function} [props.onJobApplied] - Callback when an application is submitted
 * @param {Object} [props.initialLocation] - Optional starting coordinates { lat, lng, name }
 */
export default function WorkerFeed({
  token,
  onJobApplied,
  initialLocation = DEFAULT_LOCATION,
  workerSkills = [],
}) {
  // ── Top-level state: Shared between NearbyJobFilter and JobMap ──────────────
  const [jobs, setJobs] = useState([]);
  const [userLocation, setUserLocation] = useState(initialLocation);
  const [showMap, setShowMap] = useState(true);

  // ── Location change callback from NearbyJobFilter ──────────────────────────
  const handleLocationChange = useCallback((newLoc) => {
    if (!newLoc) return;
    const lat = newLoc.lat ?? newLoc.latitude;
    const lng = newLoc.lng ?? newLoc.longitude;
    if (lat != null && lng != null && !isNaN(lat) && !isNaN(lng)) {
      setUserLocation({
        lat: Number(lat),
        lng: Number(lng),
        name: newLoc.name || 'Search Location',
      });
    }
  }, []);

  // ── Jobs fetched callback from NearbyJobFilter ──────────────────────────────
  const handleJobsFetched = useCallback((fetchedJobs) => {
    setJobs(Array.isArray(fetchedJobs) ? fetchedJobs : []);
  }, []);

  return (
    <div className="worker-feed-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
      {/* ── Synchronized JobMap Visual Overview ────────────────────────── */}
      <div
        className="worker-feed-map-card"
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '16px',
          padding: '1.25rem',
          boxShadow: '0 4px 16px -2px rgba(15, 23, 42, 0.05)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '0.85rem',
            flexWrap: 'wrap',
            gap: '0.5rem',
          }}
        >
          <div>
            <h4
              style={{
                margin: 0,
                fontSize: '1.05rem',
                fontWeight: 700,
                color: '#0f172a',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <span>🗺️</span> Interactive Job Map — {userLocation.name || 'Current Location'}
            </h4>
            <p style={{ margin: '3px 0 0 0', fontSize: '0.82rem', color: '#64748b' }}>
              Center: <strong>{userLocation.lat?.toFixed(4)}° N, {userLocation.lng?.toFixed(4)}° E</strong> · <strong>{jobs.length}</strong> active job {jobs.length === 1 ? 'pin' : 'pins'} within selected radius
            </p>
          </div>

          <button
            id="worker-feed-toggle-map"
            type="button"
            onClick={() => setShowMap(!showMap)}
            style={{
              padding: '0.4rem 0.85rem',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: showMap ? '#ecfdf5' : '#ffffff',
              color: showMap ? '#047857' : '#475569',
              fontWeight: 600,
              fontSize: '0.82rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
          >
            {showMap ? '▲ Hide Map' : '▼ Show Map'}
          </button>
        </div>

        {showMap && (
          <JobMap
            jobs={jobs}
            userLocation={userLocation}
            token={token}
            onApply={onJobApplied}
            height="400px"
            className="h-[400px] w-full rounded-lg"
          />
        )}
      </div>

      {/* ── Synchronized NearbyJobFilter with Dual Search (GPS + Geocoding) ─ */}
      <NearbyJobFilter
        token={token}
        onJobApplied={onJobApplied}
        userLocation={userLocation}
        onLocationChange={handleLocationChange}
        onJobsFetched={handleJobsFetched}
        hideEmbeddedMap={true}
        showJobCards={true}
        workerSkills={workerSkills}
      />
    </div>
  );
}
