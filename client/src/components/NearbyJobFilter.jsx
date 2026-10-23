import React, { useState, useEffect, useCallback, useRef } from 'react';
import JobCard from './JobCard';
import JobMap from './JobMap';
import SkillCategoryFilter from './SkillCategoryFilter';

const API_BASE_URL = 'http://localhost:5000';

// Standard radius presets requested by specification
const RADIUS_OPTIONS = [
  { value: 2, label: '2 km', desc: 'Walking / Immediate Neighborhood' },
  { value: 5, label: '5 km', desc: 'Local Area' },
  { value: 10, label: '10 km', desc: 'Citywide' },
  { value: 20, label: '20 km', desc: 'Metropolitan & Suburbs' },
];

// Fallback default coordinates (Kolhapur Center)
const DEFAULT_COORDS = {
  latitude: 16.7050,
  longitude: 74.2433,
  name: 'Kolhapur Central',
};

// Known regional coordinates fallback in case of external network/rate limit issues
const REGIONAL_CITY_COORDS = {
  sangli:   { lat: 16.8524, lng: 74.5815, name: 'Sangli' },
  pune:     { lat: 18.5204, lng: 73.8567, name: 'Pune' },
  jalgaon:  { lat: 21.0077, lng: 75.5626, name: 'Jalgaon' },
  kolhapur: { lat: 16.7050, lng: 74.2433, name: 'Kolhapur' },
  mumbai:   { lat: 19.0760, lng: 72.8777, name: 'Mumbai' },
  satara:   { lat: 17.6805, lng: 74.0183, name: 'Satara' },
  solapur:  { lat: 17.6599, lng: 75.9064, name: 'Solapur' },
  nashik:   { lat: 19.9975, lng: 73.7898, name: 'Nashik' },
};

/**
 * NearbyJobFilter Component
 * 
 * Implements location-based job discovery with dual search support:
 * 1. Manual city/town search via OpenStreetMap Nominatim Geocoding API
 * 2. Browser GPS via navigator.geolocation.getCurrentPosition
 * 
 * @param {Object} props
 * @param {string} [props.token] - Worker auth JWT token for applying to jobs
 * @param {function} [props.onJobApplied] - Callback after job application succeeds
 * @param {number} [props.initialRadius=10] - Initial radius in kilometers
 * @param {string} [props.initialSkill='all'] - Initial skill filter
 * @param {function} [props.onLocationChange] - Callback notifying parent: onLocationChange({ lat, lng, name })
 * @param {function} [props.onJobsFetched] - Callback notifying parent: onJobsFetched(jobs)
 * @param {Object} [props.userLocation] - Controlled worker location object from parent
 * @param {boolean} [props.hideEmbeddedMap=false] - Whether to hide embedded map (when parent renders shared map)
 * @param {boolean} [props.showJobCards=true] - Whether to render job cards list inside this component
 */
export default function NearbyJobFilter({
  token,
  onJobApplied,
  initialRadius = 10,
  initialSkill = 'all',
  onLocationChange,
  onJobsFetched,
  userLocation,
  hideEmbeddedMap = false,
  showJobCards = true,
  workerSkills = [],
}) {
  // Location state
  const [coords, setCoords] = useState(() => {
    if (userLocation) {
      const lat = userLocation.lat ?? userLocation.latitude;
      const lng = userLocation.lng ?? userLocation.longitude;
      if (lat != null && lng != null && !isNaN(lat) && !isNaN(lng)) {
        return {
          latitude: Number(lat),
          longitude: Number(lng),
          name: userLocation.name || 'Search Center',
        };
      }
    }
    return DEFAULT_COORDS;
  });

  const [locationSource, setLocationSource] = useState('default'); // 'gps' | 'city' | 'default'
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState(null);
  const [geoNotice, setGeoNotice] = useState(null);

  // Manual city search input
  const [cityInput, setCityInput] = useState('');
  const [isGeocoding, setIsGeocoding] = useState(false);

  // Search parameters
  const [radius, setRadius] = useState(initialRadius);
  const [skill, setSkill] = useState(initialSkill);
  const [selectedCategory, setSelectedCategory] = useState('All Jobs');
  const [selectedSkills, setSelectedSkills] = useState([]);

  // Job results state
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [showMap, setShowMap] = useState(true);

  // Ref callbacks to prevent stale closures and unnecessary re-render loops
  const onJobsFetchedRef = useRef(onJobsFetched);
  useEffect(() => {
    onJobsFetchedRef.current = onJobsFetched;
  }, [onJobsFetched]);

  const onLocationChangeRef = useRef(onLocationChange);
  useEffect(() => {
    onLocationChangeRef.current = onLocationChange;
  }, [onLocationChange]);

  // Sync external userLocation prop if passed from parent
  useEffect(() => {
    if (userLocation) {
      const lat = userLocation.lat ?? userLocation.latitude;
      const lng = userLocation.lng ?? userLocation.longitude;
      if (lat != null && lng != null && !isNaN(lat) && !isNaN(lng)) {
        if (Math.abs(lat - coords.latitude) > 0.0001 || Math.abs(lng - coords.longitude) > 0.0001) {
          setCoords({
            latitude: Number(lat),
            longitude: Number(lng),
            name: userLocation.name || 'Search Center',
          });
        }
      }
    }
  }, [userLocation]);

  // ── Fetch nearby jobs from backend API with category and skill filters ──────
  const fetchNearbyJobs = useCallback(async (lat, lon, maxDistance, skillFilter, categoryFilter, skillsFilter) => {
    if (lat == null || lon == null || isNaN(lat) || isNaN(lon)) return;
    setLoading(true);
    setError(null);

    try {
      let url = `${API_BASE_URL}/api/jobs/nearby?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&maxDistanceInKm=${encodeURIComponent(maxDistance)}`;
      
      const cat = categoryFilter !== undefined ? categoryFilter : selectedCategory;
      if (cat && cat !== 'All Jobs' && cat !== 'all') {
        url += `&category=${encodeURIComponent(cat)}`;
      }

      const sks = skillsFilter !== undefined ? skillsFilter : selectedSkills;
      if (Array.isArray(sks) && sks.length > 0) {
        url += `&skills=${encodeURIComponent(sks.join(','))}`;
      } else if (skillFilter && skillFilter !== 'all') {
        url += `&skill=${encodeURIComponent(skillFilter)}`;
      }

      const headers = { 'Content-Type': 'application/json' };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(url, { headers });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch nearby jobs.');
      }

      const fetchedJobs = data.jobs || [];
      setJobs(fetchedJobs);
      setHasSearched(true);

      // Pass retrieved jobs back to parent component via ref
      if (onJobsFetchedRef.current) {
        onJobsFetchedRef.current(fetchedJobs);
      }
    } catch (err) {
      console.error('Nearby jobs query error:', err);
      setError(err.message || 'Could not load nearby jobs. Make sure the server is running.');
      setJobs([]);
      if (onJobsFetchedRef.current) {
        onJobsFetchedRef.current([]);
      }
    } finally {
      setLoading(false);
    }
  }, [token, selectedCategory, selectedSkills]);

  // Initial load on mount or coordinate/radius/skill/category change
  useEffect(() => {
    if (coords?.latitude && coords?.longitude) {
      fetchNearbyJobs(coords.latitude, coords.longitude, radius, skill, selectedCategory, selectedSkills);
    }
  }, [coords.latitude, coords.longitude, radius, skill, selectedCategory, selectedSkills, fetchNearbyJobs]);

  // ── OpenStreetMap Nominatim Geocoding Handler ──────────────────────────────
  const handleCitySearch = async (overrideQuery = null) => {
    const rawQuery = (typeof overrideQuery === 'string' ? overrideQuery : cityInput).trim();
    if (!rawQuery) {
      setLocationError('Please enter a city or town name (e.g., Sangli, Pune, Jalgaon).');
      return;
    }

    setIsGeocoding(true);
    setLocationError(null);
    setGeoNotice(null);

    try {
      let resolvedLat = null;
      let resolvedLng = null;
      let resolvedName = rawQuery;

      // 1. Query free OpenStreetMap Nominatim Geocoding API
      const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(rawQuery)}&limit=1`;
      try {
        const res = await fetch(nominatimUrl, {
          headers: { Accept: 'application/json' },
        });

        if (res.ok) {
          const results = await res.json();
          if (Array.isArray(results) && results.length > 0) {
            resolvedLat = parseFloat(results[0].lat);
            resolvedLng = parseFloat(results[0].lon);
            resolvedName = results[0].display_name.split(',')[0] || rawQuery;
          }
        }
      } catch (osmNetErr) {
        console.warn('Nominatim network error, attempting regional fallback:', osmNetErr);
      }

      // 2. High-reliability fallback for standard Maharashtra cities (offline/resilient)
      if (resolvedLat == null || resolvedLng == null || isNaN(resolvedLat) || isNaN(resolvedLng)) {
        const cityKey = rawQuery.toLowerCase().replace(/[^a-z]/g, '');
        if (REGIONAL_CITY_COORDS[cityKey]) {
          resolvedLat = REGIONAL_CITY_COORDS[cityKey].lat;
          resolvedLng = REGIONAL_CITY_COORDS[cityKey].lng;
          resolvedName = REGIONAL_CITY_COORDS[cityKey].name;
        } else {
          throw new Error(`Location "${rawQuery}" not found. Please try another city or town name.`);
        }
      }

      // 3. Update local state
      const updatedCoords = {
        latitude: resolvedLat,
        longitude: resolvedLng,
        name: resolvedName,
      };
      setCoords(updatedCoords);
      setLocationSource('city');
      setGeoNotice(`📍 Located "${resolvedName}" at ${resolvedLat.toFixed(3)}° N, ${resolvedLng.toFixed(3)}° E`);

      // 4. Pass new coordinates back to parent component via onLocationChange({ lat, lng })
      if (onLocationChangeRef.current) {
        onLocationChangeRef.current({
          lat: resolvedLat,
          lng: resolvedLng,
          latitude: resolvedLat,
          longitude: resolvedLng,
          name: resolvedName,
        });
      }

      // 5. Query backend nearby jobs endpoint for new coordinates
      await fetchNearbyJobs(resolvedLat, resolvedLng, radius, skill);
    } catch (err) {
      console.error('Manual geocoding error:', err);
      setLocationError(err.message || 'Geocoding request failed. Please check spelling or connectivity.');
    } finally {
      setIsGeocoding(false);
    }
  };

  // ── Browser Geolocation Handler ("Use My Location") ─────────────────────────
  const handleUseMyLocation = () => {
    if (!('geolocation' in navigator)) {
      setLocationError('Geolocation is not supported by your browser.');
      return;
    }

    setIsLocating(true);
    setLocationError(null);
    setGeoNotice(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const newLat = parseFloat(position.coords.latitude.toFixed(5));
        const newLon = parseFloat(position.coords.longitude.toFixed(5));
        const newName = `GPS Location (${newLat.toFixed(3)}°, ${newLon.toFixed(3)}°)`;

        const newCoordsObj = {
          latitude: newLat,
          longitude: newLon,
          name: newName,
        };

        setCoords(newCoordsObj);
        setLocationSource('gps');
        setIsLocating(false);
        setLocationError(null);
        setGeoNotice(`🛰️ GPS coordinates detected: ${newLat.toFixed(4)}° N, ${newLon.toFixed(4)}° E`);

        // Pass coordinates to parent
        if (onLocationChangeRef.current) {
          onLocationChangeRef.current({
            lat: newLat,
            lng: newLon,
            latitude: newLat,
            longitude: newLon,
            name: newName,
          });
        }
      },
      (geoErr) => {
        setIsLocating(false);
        let errorMsg = 'Unable to determine your GPS location.';
        switch (geoErr.code) {
          case geoErr.PERMISSION_DENIED:
            errorMsg = 'Location permission denied. Using default Kolhapur coordinates.';
            break;
          case geoErr.POSITION_UNAVAILABLE:
            errorMsg = 'GPS signal unavailable. Using default Kolhapur coordinates.';
            break;
          case geoErr.TIMEOUT:
            errorMsg = 'Location request timed out. Please try again.';
            break;
          default:
            errorMsg = geoErr.message || 'Failed to capture GPS location.';
        }
        setLocationError(errorMsg);
        setCoords(DEFAULT_COORDS);
        setLocationSource('default');

        if (onLocationChangeRef.current) {
          onLocationChangeRef.current({
            lat: DEFAULT_COORDS.latitude,
            lng: DEFAULT_COORDS.longitude,
            name: DEFAULT_COORDS.name,
          });
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  };

  const handleResetToDemo = () => {
    setCoords(DEFAULT_COORDS);
    setLocationSource('default');
    setLocationError(null);
    setGeoNotice(null);
    setCityInput('');

    if (onLocationChangeRef.current) {
      onLocationChangeRef.current({
        lat: DEFAULT_COORDS.latitude,
        lng: DEFAULT_COORDS.longitude,
        name: DEFAULT_COORDS.name,
      });
    }
  };

  return (
    <div className="nearby-job-filter-container">
      {/* ── Control Header Panel ─────────────────────────────────────────── */}
      <div className="nearby-filter-card">
        <div className="nearby-filter-header">
          <div className="nearby-filter-title-group">
            <div className="nearby-icon-badge">📍</div>
            <div>
              <h3 className="nearby-title">Location & Radius Discovery</h3>
              <p className="nearby-subtitle">
                Search any city or use your browser GPS to discover daily wage jobs within your desired distance
              </p>
            </div>
          </div>

          {/* Location Trigger Button */}
          <div className="nearby-location-action">
            <button
              id="btn-use-my-location"
              type="button"
              className={`btn-use-location ${isLocating ? 'locating' : ''} ${locationSource === 'gps' ? 'active-gps' : ''}`}
              onClick={handleUseMyLocation}
              disabled={isLocating}
              title="Detect current coordinates using browser GPS"
            >
              {isLocating ? (
                <>
                  <span className="spinner-dot" /> Detecting GPS...
                </>
              ) : locationSource === 'gps' ? (
                <>
                  <span className="gps-live-dot" /> GPS Active
                </>
              ) : (
                <>
                  <svg className="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M12 2v3m0 14v3M2 12h3m14 0h3" />
                    <circle cx="12" cy="12" r="8" />
                  </svg>
                  Use My GPS Location
                </>
              )}
            </button>
          </div>
        </div>

        {/* ── Dual Search Bar: Manual City/Town Search Field ──────────────── */}
        <div className="nearby-city-search-box">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleCitySearch();
            }}
            className="city-search-form"
          >
            <div className="city-input-wrapper">
              <span className="city-input-icon">🔍</span>
              <input
                id="manual-city-search-input"
                type="text"
                className="city-search-input-field"
                placeholder="Search any city or town (e.g., Sangli, Pune, Jalgaon, Kolhapur)..."
                value={cityInput}
                onChange={(e) => setCityInput(e.target.value)}
                disabled={isGeocoding}
              />
              {cityInput && (
                <button
                  type="button"
                  className="btn-clear-city"
                  onClick={() => setCityInput('')}
                  title="Clear input"
                >
                  ✕
                </button>
              )}
            </div>
            <button
              id="btn-submit-city-search"
              type="submit"
              className="btn-search-city-submit"
              disabled={isGeocoding || !cityInput.trim()}
            >
              {isGeocoding ? 'Locating...' : 'Search City'}
            </button>
          </form>

          {/* Quick Regional Presets */}
          <div className="city-quick-presets">
            <span className="presets-label">Popular Locations:</span>
            {['Sangli', 'Pune', 'Jalgaon', 'Kolhapur'].map((cityName) => (
              <button
                key={cityName}
                type="button"
                className={`preset-city-btn ${coords.name?.toLowerCase().includes(cityName.toLowerCase()) ? 'active' : ''}`}
                onClick={() => {
                  setCityInput(cityName);
                  handleCitySearch(cityName);
                }}
              >
                📍 {cityName}
              </button>
            ))}
          </div>
        </div>

        {/* Current Coordinates & Status Bar */}
        <div className="nearby-status-bar">
          <div className="nearby-coords-pill">
            <span className="coords-icon">🎯</span>
            <span className="coords-text">
              <strong>Active Center:</strong> {coords.name || 'Kolhapur'} ({coords.latitude.toFixed(4)}° N, {coords.longitude.toFixed(4)}° E)
            </span>
            <span className={`coords-tag ${locationSource}`}>
              {locationSource === 'gps'
                ? '🛰️ Browser GPS'
                : locationSource === 'city'
                ? '🏙️ Manual Search'
                : '📍 Default (Kolhapur)'}
            </span>
          </div>

          {(locationSource !== 'default' || coords.latitude !== DEFAULT_COORDS.latitude) && (
            <button
              type="button"
              className="btn-link-reset"
              onClick={handleResetToDemo}
              title="Reset search center to Kolhapur demo coordinates"
            >
              Reset to Kolhapur
            </button>
          )}
        </div>

        {/* Success / Feedback notice */}
        {geoNotice && (
          <div className="nearby-alert-success" style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#047857', padding: '0.5rem 0.85rem', borderRadius: '8px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>✅</span> {geoNotice}
          </div>
        )}

        {/* Geolocation feedback / error message */}
        {locationError && (
          <div className="nearby-alert-info">
            <span>ℹ️</span> {locationError}
          </div>
        )}

        {/* ── Radius Selection Component (Slider + Dropdown) ────────────────── */}
        <div className="nearby-controls-grid">
          {/* Dropdown Selector */}
          <div className="nearby-control-group">
            <label htmlFor="radius-dropdown-select" className="control-label">
              Search Radius (Dropdown)
            </label>
            <div className="select-wrapper">
              <select
                id="radius-dropdown-select"
                className="radius-select-input"
                value={radius}
                onChange={(e) => setRadius(Number(e.target.value))}
              >
                {RADIUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label} — {opt.desc}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Interactive Range Slider */}
          <div className="nearby-control-group">
            <div className="control-label-row">
              <label htmlFor="radius-slider-input" className="control-label">
                Distance Radius (Slider)
              </label>
              <span className="radius-value-pill">{radius} km</span>
            </div>
            <div className="slider-container">
              <input
                id="radius-slider-input"
                type="range"
                min="2"
                max="20"
                step="1"
                value={radius}
                onChange={(e) => setRadius(Number(e.target.value))}
                className="radius-range-slider"
              />
              <div className="slider-ticks">
                {RADIUS_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`slider-tick-btn ${radius === opt.value ? 'active' : ''}`}
                    onClick={() => setRadius(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Radius quick-pill shortcuts */}
        <div className="nearby-quick-pills">
          <span className="pills-label">Quick Radius:</span>
          {RADIUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`radius-pill ${radius === opt.value ? 'selected' : ''}`}
              onClick={() => setRadius(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Trade Skill & Category Filter System ────────────────────────── */}
      <SkillCategoryFilter
        selectedCategory={selectedCategory}
        selectedSkills={selectedSkills}
        activeJobCount={jobs.length}
        onFilterChange={({ category, skills: nextSkills }) => {
          setSelectedCategory(category);
          setSelectedSkills(nextSkills);
          fetchNearbyJobs(coords.latitude, coords.longitude, radius, skill, category, nextSkills);
        }}
      />

      {/* ── Results Summary Header ───────────────────────────────────────── */}
      <div className="nearby-results-header">
        <div className="results-count-text">
          {loading ? (
            <span>Searching jobs within {radius} km of {coords.name || 'selected location'}...</span>
          ) : (
            <span>
              Found <strong>{jobs.length}</strong> active {jobs.length === 1 ? 'job' : 'jobs'} within <strong>{radius} km</strong> of <strong>{coords.name || 'selected location'}</strong>
            </span>
          )}
        </div>

        <div className="results-actions" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {!hideEmbeddedMap && (
            <button
              id="btn-toggle-nearby-map"
              type="button"
              className="btn-refresh-nearby"
              style={{
                background: showMap ? '#ecfdf5' : '#ffffff',
                color: showMap ? '#047857' : '#475569',
                borderColor: showMap ? '#10b981' : '#cbd5e1',
                fontWeight: 600,
              }}
              onClick={() => setShowMap(!showMap)}
              title="Toggle interactive visual map"
            >
              🗺️ {showMap ? 'Hide Map' : 'Show Map'}
            </button>
          )}
          <button
            type="button"
            className="btn-refresh-nearby"
            onClick={() => fetchNearbyJobs(coords.latitude, coords.longitude, radius, skill, selectedCategory, selectedSkills)}
            disabled={loading}
          >
            {loading ? '↻ Loading...' : '↻ Refresh'}
          </button>
        </div>
      </div>

      {/* ── Interactive Visual Job Map (if not hidden by parent) ────────── */}
      {!hideEmbeddedMap && !loading && showMap && (
        <div style={{ marginBottom: '1rem' }}>
          <JobMap
            jobs={jobs}
            userLocation={{
              lat: coords.latitude,
              lng: coords.longitude,
              name: coords.name,
            }}
            token={token}
            onApply={onJobApplied}
            height="360px"
            className="h-[360px] w-full rounded-lg"
            workerSkills={workerSkills}
          />
        </div>
      )}

      {/* ── Error Banner ─────────────────────────────────────────────────── */}
      {error && (
        <div className="nearby-error-card">
          <p className="error-title">⚠️ Failed to query nearby jobs</p>
          <p className="error-detail">{error}</p>
          <button
            type="button"
            className="btn-retry"
            onClick={() => fetchNearbyJobs(coords.latitude, coords.longitude, radius, skill)}
          >
            Retry Search
          </button>
        </div>
      )}

      {/* ── Loading State ─────────────────────────────────────────────────── */}
      {loading && (
        <div className="nearby-loading-grid">
          {[1, 2, 3].map((n) => (
            <div key={n} className="nearby-shimmer-card">
              <div className="shimmer-line short" />
              <div className="shimmer-line long" />
              <div className="shimmer-line medium" />
            </div>
          ))}
        </div>
      )}

      {/* ── Empty State ──────────────────────────────────────────────────── */}
      {!loading && !error && hasSearched && jobs.length === 0 && (
        <div className="nearby-empty-state">
          <div className="empty-radar-icon">📡</div>
          <h4 className="empty-title">No jobs found within {radius} km of {coords.name || 'this location'}</h4>
          <p className="empty-description">
            There are currently no active daily wage jobs posted within {radius} km. Try expanding your search radius to 20 km or searching another nearby town.
          </p>
          {radius < 20 && (
            <div className="empty-actions">
              <button
                type="button"
                className="btn-expand-radius"
                onClick={() => setRadius(radius <= 5 ? 10 : 20)}
              >
                Expand Search to {radius <= 5 ? '10 km' : '20 km'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Nearby Jobs Grid ─────────────────────────────────────────────── */}
      {showJobCards && !loading && jobs.length > 0 && (
        <div className="nearby-jobs-grid">
          {jobs.map((job, idx) => (
            <div key={job._id || idx} className="nearby-job-card-wrapper">
              {/* Highlighted distance badge prominently at the top */}
              <div className="nearby-distance-banner">
                <span className="distance-badge">
                  <svg className="pin-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  {job.distance != null ? `${job.distance} km away` : (job.distanceInKm != null ? `${job.distanceInKm} km away` : 'Nearby')}
                </span>
                <span className="radius-relative-tag">
                  {job.distance <= 2 ? '⚡ Very Close' : (job.distance <= 5 ? '🚲 Short Ride' : '🚗 Commute')}
                </span>
              </div>

              {/* Render using standard JobCard */}
              <JobCard
                job={job}
                distance={job.distance != null ? `${job.distance} km away` : `${job.distanceInKm} km away`}
                token={token}
                workerSkills={workerSkills}
                onApply={() => {
                  if (onJobApplied) onJobApplied(job);
                }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
