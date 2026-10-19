import React, { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const API_BASE_URL = 'http://localhost:5000';

// ── Skills catalogue matching FairConnect standard trades ────────────────────
export const SKILL_OPTIONS = [
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

// Fallback regional coordinates for common Maharashtra cities
const REGIONAL_COORDS = {
  kolhapur: { lat: 16.7049, lon: 74.2433, name: 'Kolhapur' },
  sangli:   { lat: 16.8524, lon: 74.5815, name: 'Sangli' },
  pune:     { lat: 18.5204, lon: 73.8567, name: 'Pune' },
  mumbai:   { lat: 19.0760, lon: 72.8777, name: 'Mumbai' },
  jalgaon:  { lat: 21.0077, lon: 75.5626, name: 'Jalgaon' },
  satara:   { lat: 17.6805, lon: 74.0183, name: 'Satara' },
  solapur:  { lat: 17.6599, lon: 75.9064, name: 'Solapur' },
  nashik:   { lat: 19.9975, lon: 73.7898, name: 'Nashik' },
};

const DEFAULT_REGION = { lat: 16.7049, lon: 74.2433, name: 'Kolhapur Region' };

/**
 * PostJobForm Component
 * 
 * Intercepts job submission to perform forward geocoding on the city / location
 * string using OpenStreetMap Nominatim API, then packages the payload with
 * GeoJSON-ready coordinates before saving to MongoDB.
 * 
 * @param {Object} props
 * @param {string} [props.token] - Employer JWT token
 * @param {function} [props.onJobCreated] - Callback fired with created job object
 * @param {function} [props.onSuccess] - Alias callback for successful job creation
 */
export default function PostJobForm({ token: propToken, onJobCreated, onSuccess }) {
  const { token: contextToken } = useAuth();
  const token = propToken || contextToken;

  const [formData, setFormData] = useState({
    title: '',
    skill: '',
    city: '',
    dailyWage: '',
    description: '',
  });

  // ── GPS Location State ───────────────────────────────────────────────────────
  const [locationInput, setLocationInput] = useState('');
  const [coordinates, setCoordinates] = useState({ lat: null, lng: null });
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [geocodingStatus, setGeocodingStatus] = useState(null); // 'geocoding' | 'resolved' | 'fallback'
  const [feedback, setFeedback] = useState(null); // { type: 'error' | 'success' | 'warning', message: '' }
  const [resolvedCoords, setResolvedCoords] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (name === 'city') {
      setLocationInput(value);
      // Reset coordinates if user manually changes text after GPS detection
      setCoordinates({ lat: null, lng: null });
      setResolvedCoords(null);
    }
    setFeedback(null);
  };

  /**
   * Browser Geolocation Detection & Reverse Geocoding
   * Uses navigator.geolocation.getCurrentPosition and OpenStreetMap Nominatim reverse endpoint
   */
  const handleDetectGPS = () => {
    if (!('geolocation' in navigator)) {
      setFeedback({
        type: 'error',
        message: 'Geolocation is not supported by your browser.',
      });
      return;
    }

    setIsDetectingLocation(true);
    setFeedback(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          // Reverse Geocoding Call using OpenStreetMap Nominatim
          const reverseUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`;
          const response = await axios.get(reverseUrl, {
            headers: { Accept: 'application/json' },
            timeout: 8000,
          });

          const address = response.data?.address || {};
          const detectedCity =
            address.city ||
            address.suburb ||
            address.town ||
            address.village ||
            address.municipality ||
            address.county ||
            address.state_district ||
            (response.data?.display_name ? response.data.display_name.split(',')[0].trim() : '') ||
            'Detected Location';

          const latNum = parseFloat(latitude);
          const lngNum = parseFloat(longitude);

          // Auto-fill input & store coordinates in state
          setLocationInput(detectedCity);
          setFormData((prev) => ({ ...prev, city: detectedCity }));
          setCoordinates({ lat: latNum, lng: lngNum });
          setResolvedCoords({
            lat: latNum,
            lon: lngNum,
            displayName: response.data?.display_name || detectedCity,
            isFallback: false,
          });
          setGeocodingStatus('resolved');
          setFeedback({
            type: 'success',
            message: `GPS location detected: ${detectedCity} (${latNum.toFixed(4)}° N, ${lngNum.toFixed(4)}° E)`,
          });
        } catch (err) {
          console.warn('Reverse geocoding warning:', err);
          const latNum = parseFloat(latitude);
          const lngNum = parseFloat(longitude);
          const fallbackName = `Location (${latNum.toFixed(3)}°, ${lngNum.toFixed(3)}°)`;

          setLocationInput(fallbackName);
          setFormData((prev) => ({ ...prev, city: fallbackName }));
          setCoordinates({ lat: latNum, lng: lngNum });
          setResolvedCoords({
            lat: latNum,
            lon: lngNum,
            displayName: fallbackName,
            isFallback: false,
          });
          setGeocodingStatus('resolved');
          setFeedback({
            type: 'warning',
            message: `Retrieved GPS coordinates (${latNum.toFixed(4)}°, ${lngNum.toFixed(4)}°), but reverse geocoding timed out.`,
          });
        } finally {
          setIsDetectingLocation(false);
        }
      },
      (error) => {
        console.error('Geolocation error:', error);
        setIsDetectingLocation(false);
        let errorMsg = 'Failed to retrieve your location.';
        if (error.code === error.PERMISSION_DENIED) {
          errorMsg = 'Location permission was denied. Please allow location access or type your city manually.';
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          errorMsg = 'Location information is unavailable.';
        } else if (error.code === error.TIMEOUT) {
          errorMsg = 'Location request timed out. Please try again.';
        }
        setFeedback({ type: 'error', message: errorMsg });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  };

  /**
   * Forward Geocoding using OpenStreetMap Nominatim API
   * Queries Nominatim with user location string and extracts lat/lon from top result
   */
  const forwardGeocode = async (locInput) => {
    const query = (locInput || '').trim();
    if (!query) {
      return { ...DEFAULT_REGION, isFallback: true };
    }

    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
      const response = await axios.get(url, {
        headers: { Accept: 'application/json' },
        timeout: 8000,
      });

      if (Array.isArray(response.data) && response.data.length > 0) {
        const topResult = response.data[0];
        const lat = parseFloat(topResult.lat);
        const lon = parseFloat(topResult.lon);

        if (!isNaN(lat) && !isNaN(lon)) {
          return {
            lat,
            lon,
            displayName: topResult.display_name,
            isFallback: false,
          };
        }
      }

      // Check regional city fallback if Nominatim returned 0 results
      const sanitizedKey = query.toLowerCase().replace(/[^a-z]/g, '');
      if (REGIONAL_COORDS[sanitizedKey]) {
        return {
          lat: REGIONAL_COORDS[sanitizedKey].lat,
          lon: REGIONAL_COORDS[sanitizedKey].lon,
          displayName: REGIONAL_COORDS[sanitizedKey].name,
          isFallback: true,
        };
      }

      return { ...DEFAULT_REGION, isFallback: true };
    } catch (err) {
      console.warn('Nominatim geocoding request warning:', err.message);
      const sanitizedKey = query.toLowerCase().replace(/[^a-z]/g, '');
      if (REGIONAL_COORDS[sanitizedKey]) {
        return {
          lat: REGIONAL_COORDS[sanitizedKey].lat,
          lon: REGIONAL_COORDS[sanitizedKey].lon,
          displayName: REGIONAL_COORDS[sanitizedKey].name,
          isFallback: true,
        };
      }
      return { ...DEFAULT_REGION, isFallback: true };
    }
  };

  /**
   * Form Submission Handler
   * If GPS coordinates already exist in state, uses them directly (no extra forward search).
   * Otherwise forward geocodes the manual city input.
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setFeedback(null);

    const { title, skill, dailyWage, description } = formData;
    const effectiveCity = (locationInput || formData.city || '').trim();

    // Client-side validations
    if (!title.trim()) {
      setFeedback({ type: 'error', message: 'Please provide a job title.' });
      return;
    }
    if (!skill) {
      setFeedback({ type: 'error', message: 'Please select a required trade skill.' });
      return;
    }
    if (!effectiveCity) {
      setFeedback({ type: 'error', message: 'Please specify the job city or locality.' });
      return;
    }
    if (!dailyWage || Number(dailyWage) < 1) {
      setFeedback({ type: 'error', message: 'Please provide a valid daily wage (minimum ₹1).' });
      return;
    }

    setIsSubmitting(true);
    setGeocodingStatus('geocoding');

    try {
      // 1. Coordinates: Use stored GPS lat/lng directly if available, otherwise forward geocode
      let geocoded;
      if (coordinates.lat !== null && coordinates.lng !== null) {
        geocoded = {
          lat: coordinates.lat,
          lon: coordinates.lng,
          displayName: effectiveCity,
          isFallback: false,
        };
        setResolvedCoords(geocoded);
        setGeocodingStatus('resolved');
      } else {
        geocoded = await forwardGeocode(effectiveCity);
        setResolvedCoords(geocoded);
        if (geocoded.isFallback) {
          setGeocodingStatus('fallback');
        } else {
          setGeocodingStatus('resolved');
        }
      }

      // 2. Format Structured Backend Payload
      const payload = {
        title: title.trim(),
        skill: skill,
        requiredSkill: skill.toLowerCase(),
        city: effectiveCity,
        dailyWage: Number(dailyWage),
        wage: Number(dailyWage),
        description: description.trim() || `${title.trim()} in ${effectiveCity}`,
        latitude: geocoded.lat,
        longitude: geocoded.lon,
      };

      // 3. Post to backend route /api/jobs
      const response = await axios.post(`${API_BASE_URL}/api/jobs`, payload, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const createdJob = response.data.job;

      setFeedback({
        type: 'success',
        message: geocoded.isFallback
          ? `Job posted successfully! (Location resolved using regional default: ${geocoded.lat.toFixed(4)}° N, ${geocoded.lon.toFixed(4)}° E)`
          : `Job posted successfully with coordinates: ${geocoded.lat.toFixed(4)}° N, ${geocoded.lon.toFixed(4)}° E`,
      });

      // Clear form
      setFormData({
        title: '',
        skill: '',
        city: '',
        dailyWage: '',
        description: '',
      });
      setLocationInput('');
      setCoordinates({ lat: null, lng: null });

      // Fire callbacks
      if (typeof onJobCreated === 'function') {
        onJobCreated(createdJob);
      }
      if (typeof onSuccess === 'function') {
        onSuccess(createdJob);
      }
    } catch (err) {
      console.error('Job creation error:', err);
      const errMsg = err.response?.data?.message || err.message || 'Failed to post job. Please try again.';
      setFeedback({ type: 'error', message: errMsg });
    } finally {
      setIsSubmitting(false);
    }
  };

  const descLen = formData.description.length;

  return (
    <div className="post-job-form-wrapper">
      <form id="post-job-form" className="post-job-form" onSubmit={handleSubmit} noValidate>
        {/* Status / Alert Feedback Banner */}
        {feedback && (
          <div
            id="post-job-feedback-alert"
            style={{
              padding: '0.75rem 1rem',
              borderRadius: '10px',
              marginBottom: '1.25rem',
              fontSize: '0.85rem',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              backgroundColor: feedback.type === 'success' ? '#ecfdf5' : feedback.type === 'warning' ? '#fffbeb' : '#fff1f2',
              color: feedback.type === 'success' ? '#047857' : feedback.type === 'warning' ? '#b45309' : '#be123c',
              border: `1px solid ${feedback.type === 'success' ? '#a7f3d0' : feedback.type === 'warning' ? '#fde68a' : '#fecdd3'}`,
            }}
          >
            <span>{feedback.type === 'success' ? '✅' : feedback.type === 'warning' ? '⚠️' : '❌'}</span>
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Row 1: Title + Skill */}
        <div className="pjf-row">
          <div className="form-group" style={{ flex: 2 }}>
            <label className="form-label" htmlFor="job-title">
              Job Title <span style={{ color: '#e11d48' }}>*</span>
            </label>
            <div className="input-wrapper">
              <span className="input-icon">💼</span>
              <input
                id="job-title"
                name="title"
                type="text"
                className="form-input"
                placeholder="e.g. Site Helper Needed"
                maxLength={100}
                value={formData.title}
                onChange={handleChange}
                disabled={isSubmitting}
                required
              />
            </div>
          </div>

          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label" htmlFor="job-skill">
              Required Skill <span style={{ color: '#e11d48' }}>*</span>
            </label>
            <div className="input-wrapper">
              <span className="input-icon">🛠️</span>
              <select
                id="job-skill"
                name="skill"
                className="form-select"
                value={formData.skill}
                onChange={handleChange}
                disabled={isSubmitting}
                required
              >
                <option value="" disabled>Select trade skill…</option>
                {SKILL_OPTIONS.map((s) => (
                  <option key={s.id} value={s.label}>
                    {s.icon} {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group" style={{ flex: 1.5, minWidth: '280px' }}>
            <label className="form-label" htmlFor="job-city">
              Job City / Location <span style={{ color: '#e11d48' }}>*</span>
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <div className="input-wrapper" style={{ flex: 1 }}>
                <span className="input-icon">📍</span>
                <input
                  id="job-city"
                  name="city"
                  type="text"
                  className="form-input"
                  placeholder="e.g. Kolhapur, Rajarampuri"
                  maxLength={60}
                  value={locationInput}
                  onChange={handleChange}
                  disabled={isSubmitting || isDetectingLocation}
                  required
                />
              </div>
              <button
                id="use-my-gps-btn"
                type="button"
                className={`btn-use-location ${isDetectingLocation ? 'locating' : ''} ${coordinates.lat !== null ? 'active-gps' : ''}`}
                onClick={handleDetectGPS}
                disabled={isDetectingLocation || isSubmitting}
                title="Use My GPS Location"
                style={{
                  height: '46px',
                  padding: '0 0.85rem',
                  fontSize: '0.82rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  flexShrink: 0,
                  whiteSpace: 'nowrap',
                }}
              >
                {isDetectingLocation ? (
                  <>
                    <span
                      className="spinner"
                      style={{
                        width: 14,
                        height: 14,
                        border: '2px solid rgba(4, 120, 87, 0.3)',
                        borderTopColor: '#047857',
                        borderRadius: '50%',
                        display: 'inline-block',
                      }}
                    />
                    <span>Detecting…</span>
                  </>
                ) : coordinates.lat !== null ? (
                  <>
                    <span className="gps-live-dot" />
                    <span>GPS Active</span>
                  </>
                ) : (
                  <>
                    <svg
                      className="btn-icon"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      style={{ width: 16, height: 16 }}
                    >
                      <circle cx="12" cy="12" r="3" />
                      <path d="M12 2v3m0 14v3M2 12h3m14 0h3" />
                      <circle cx="12" cy="12" r="8" />
                    </svg>
                    <span>Use My GPS Location</span>
                  </>
                )}
              </button>
            </div>
            {coordinates.lat !== null && coordinates.lng !== null && (
              <div
                style={{
                  fontSize: '0.74rem',
                  color: '#059669',
                  marginTop: '0.35rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
              >
                <span className="gps-live-dot" style={{ width: 7, height: 7 }} />
                <span>
                  GPS: <strong>{coordinates.lat.toFixed(4)}° N, {coordinates.lng.toFixed(4)}° E</strong>
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Row 2: Description */}
        <div className="form-group">
          <label className="form-label" htmlFor="job-description">
            Description
            <span style={{ float: 'right', fontWeight: 400, color: descLen > 900 ? '#f43f5e' : '#64748b' }}>
              {descLen}/1000
            </span>
          </label>
          <textarea
            id="job-description"
            name="description"
            className="form-input pjf-textarea"
            placeholder="Describe the job, working hours, exact site address, safety equipment required…"
            maxLength={1000}
            rows={3}
            value={formData.description}
            onChange={handleChange}
            disabled={isSubmitting}
          />
        </div>

        {/* Row 3: Wage + Submit Button */}
        <div className="pjf-row pjf-row-bottom" style={{ display: 'flex', alignItems: 'flex-end', gap: '1rem' }}>
          <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
            <label className="form-label" htmlFor="job-wage">
              Daily Wage (₹) <span style={{ color: '#e11d48' }}>*</span>
            </label>
            <div className="input-wrapper">
              <span className="input-icon">💰</span>
              <input
                id="job-wage"
                name="dailyWage"
                type="number"
                className="form-input"
                placeholder="e.g. 800"
                min={1}
                value={formData.dailyWage}
                onChange={handleChange}
                disabled={isSubmitting}
                required
              />
            </div>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {/* Live Nominatim Geocoding Indicator */}
            {isSubmitting && (
              <div style={{ fontSize: '0.75rem', color: '#2563eb', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span className="spinner" style={{ display: 'inline-block', width: 12, height: 12, border: '2px solid #93c5fd', borderTopColor: '#2563eb', borderRadius: '50%' }} />
                Converting &ldquo;{formData.city}&rdquo; to GeoJSON coordinates via OpenStreetMap...
              </div>
            )}
            {!isSubmitting && resolvedCoords && (
              <div style={{ fontSize: '0.74rem', color: '#059669', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <span>🎯</span>
                <span>GeoJSON: [{resolvedCoords.lon?.toFixed(4)}, {resolvedCoords.lat?.toFixed(4)}]</span>
              </div>
            )}

            <button
              id="submit-post-job-btn"
              type="submit"
              className="btn-submit-job"
              disabled={isSubmitting}
              style={{
                width: '100%',
                minHeight: '48px',
                padding: '0.75rem 1.5rem',
                borderRadius: '12px',
                border: 'none',
                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.92rem',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                transition: 'all 0.2s ease',
              }}
            >
              {isSubmitting ? (
                <>
                  <span className="spinner" style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%' }} />
                  Forward Geocoding & Posting…
                </>
              ) : (
                <>
                  <span>📢</span> Post Job
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
