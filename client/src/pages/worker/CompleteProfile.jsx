import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import CertificateUpload from '../../components/CertificateUpload';

// ── Skill catalogue ──────────────────────────────────────────────────────────
const SKILLS = [
  { id: 'plumbing',    label: 'Plumbing',    icon: '🔧' },
  { id: 'electrician', label: 'Electrician', icon: '⚡' },
  { id: 'masonry',     label: 'Masonry',     icon: '🧱' },
];

const PRESET_CITIES = ['Kolhapur', 'Sangli', 'Pune', 'Satara', 'Ichalkaranji'];

const API = 'http://localhost:5000';

export default function CompleteProfile() {
  const { token } = useAuth();
  const navigate = useNavigate();

  // ── Skill state ────────────────────────────────────────────────────────────
  const [selectedSkills, setSelectedSkills] = useState([]);
  const [city,           setCity]           = useState('');
  const [skillsSaving,   setSkillsSaving]   = useState(false);
  const [skillsMsg,      setSkillsMsg]       = useState(null); // { type, text }

  // ── New profile fields ─────────────────────────────────────────────────────
  const [phoneNumber,       setPhoneNumber]       = useState('');
  const [dateOfBirth,       setDateOfBirth]       = useState('');
  const [yearsOfExperience, setYearsOfExperience] = useState('');
  const [bio,               setBio]               = useState('');

  // ── Verification status ────────────────────────────────────────────────────
  const [verificationStatus, setVerificationStatus] = useState('unverified');
  const [skillsDone,         setSkillsDone]         = useState(false);
  const [verifyDone,         setVerifyDone]         = useState(false);

  // Load existing profile to pre-fill
  useEffect(() => {
    if (!token) return;
    fetch(`${API}/api/worker/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.skills && data.skills.length > 0) {
          setSelectedSkills(data.skills);
          setSkillsDone(true);
        }
        if (data.city) setCity(data.city);
        if (data.phoneNumber) setPhoneNumber(data.phoneNumber);
        if (data.dateOfBirth) setDateOfBirth(data.dateOfBirth.slice(0, 10)); // 'YYYY-MM-DD'
        if (data.yearsOfExperience !== null && data.yearsOfExperience !== undefined) {
          setYearsOfExperience(String(data.yearsOfExperience));
        }
        if (data.bio) setBio(data.bio);

        setVerificationStatus(data.verificationStatus || 'unverified');
        if (data.isVerified || data.verificationStatus === 'verified') {
          setVerifyDone(true);
        }
      })
      .catch(() => {});
  }, [token]);

  // ── Skill toggle ───────────────────────────────────────────────────────────
  const toggleSkill = (id) => {
    setSelectedSkills((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  // ── Save skills, city & profile fields ────────────────────────────────────
  const handleSaveSkills = async () => {
    if (selectedSkills.length === 0) {
      setSkillsMsg({ type: 'error', text: 'Please select at least one skill.' });
      return;
    }

    if (phoneNumber.trim()) {
      const digits = phoneNumber.replace(/[\s\-+]/g, '').replace(/^91/, '');
      if (!/^[6-9]\d{9}$/.test(digits)) {
        setSkillsMsg({ type: 'error', text: '📞 Phone number must be a valid 10-digit Indian number (starts with 6–9).' });
        return;
      }
    }

    if (dateOfBirth) {
      const ageDiffMs = Date.now() - new Date(dateOfBirth).getTime();
      const age = Math.floor(ageDiffMs / (1000 * 60 * 60 * 24 * 365.25));
      if (age < 20) {
        setSkillsMsg({ type: 'error', text: '🎂 You must be at least 20 years old to register as a worker.' });
        return;
      }
    }

    if (bio.trim().length > 300) {
      setSkillsMsg({ type: 'error', text: '📝 Bio cannot exceed 300 characters.' });
      return;
    }

    setSkillsSaving(true);
    setSkillsMsg(null);
    try {
      const payload = {
        skills: selectedSkills,
        primarySkill: selectedSkills[0],
      };
      if (city.trim())              payload.city             = city.trim();
      if (phoneNumber.trim())        payload.phoneNumber       = phoneNumber.trim();
      if (dateOfBirth)               payload.dateOfBirth       = dateOfBirth;
      if (yearsOfExperience !== '')  payload.yearsOfExperience = Number(yearsOfExperience);
      if (bio.trim())                payload.bio               = bio.trim();

      const res = await fetch(`${API}/api/worker/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      setSkillsMsg({ type: 'success', text: '✅ Profile details saved successfully!' });
      setSkillsDone(true);
    } catch (err) {
      setSkillsMsg({ type: 'error', text: err.message });
    } finally {
      setSkillsSaving(false);
    }
  };

  const stepState = (done, active) => {
    if (done)   return 'done';
    if (active) return 'active';
    return 'inactive';
  };

  return (
    <div className="profile-page">
      <div className="profile-container">

        {/* ── Top Nav ── */}
        <header className="dashboard-header" style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div className="brand-icon" style={{ width: 36, height: 36, fontSize: '1rem' }}>🔗</div>
            <span className="dashboard-title">FairConnect</span>
          </div>
          <button
            id="skip-profile-btn"
            className="btn-secondary"
            onClick={() => navigate('/worker/dashboard')}
          >
            Go to Dashboard
          </button>
        </header>

        {/* ── Page heading ── */}
        <div style={{ marginBottom: '1.75rem' }}>
          <h1 className="page-title" style={{ marginBottom: '0.3rem' }}>Complete Your Profile</h1>
          <p className="page-subtitle" style={{ marginBottom: 0 }}>
            Set up your skills and verify your ITI or Vocational Training certificate to earn +20 Fairness Score.
          </p>
        </div>

        {/* ── Stepper ── */}
        <div className="profile-stepper">
          <div className="step-item">
            <div className={`step-dot ${stepState(skillsDone, true)}`}>
              {skillsDone ? '✓' : '1'}
            </div>
            <span className={`step-label ${stepState(skillsDone, true)}`}>Select Skills</span>
          </div>
          <div className="step-connector" />
          <div className="step-item">
            <div className={`step-dot ${stepState(verifyDone, skillsDone)}`}>
              {verifyDone ? '✓' : '2'}
            </div>
            <span className={`step-label ${stepState(verifyDone, skillsDone)}`}>Verify Skill Certificate</span>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 1 — SKILL SELECTION
        ══════════════════════════════════════════════════════════════════ */}
        <div className="profile-section">
          <div className="section-header">
            <div className="section-icon">🛠️</div>
            <div>
              <div className="section-title">Select Your Skills</div>
              <div className="section-subtitle">
                Tap the skills that match your expertise (up to 10)
              </div>
            </div>
          </div>

          <div className="skill-grid" role="group" aria-label="Skill selection">
            {SKILLS.map((skill) => (
              <button
                key={skill.id}
                id={`skill-tile-${skill.id}`}
                className={`skill-tile ${selectedSkills.includes(skill.id) ? 'selected' : ''}`}
                onClick={() => toggleSkill(skill.id)}
                aria-pressed={selectedSkills.includes(skill.id)}
                type="button"
              >
                <div className="skill-tile-icon">{skill.icon}</div>
                <div className="skill-tile-label">{skill.label}</div>
              </button>
            ))}
          </div>

          {selectedSkills.length > 0 && (
            <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1.25rem' }}>
              {selectedSkills.length} skill{selectedSkills.length > 1 ? 's' : ''} selected
              {selectedSkills.length > 0 && (
                <> · Primary: <strong style={{ color: '#047857' }}>
                  {SKILLS.find((s) => s.id === selectedSkills[0])?.label}
                </strong></>
              )}
            </p>
          )}

          {/* City / Location selection */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.4rem', color: 'var(--clr-text-heading)' }}>
              📍 Your City (Earns +30 Proximity Score for local jobs):
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
              {PRESET_CITIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`preset-city-btn ${city.toLowerCase() === c.toLowerCase() ? 'active' : ''}`}
                  onClick={() => setCity(c)}
                >
                  {c}
                </button>
              ))}
            </div>
            <input
              type="text"
              placeholder="Or type your city / town..."
              value={city}
              onChange={(e) => setCity(e.target.value)}
              style={{
                width: '100%',
                maxWidth: 360,
                padding: '0.55rem 0.85rem',
                borderRadius: '8px',
                border: '1px solid var(--clr-border)',
                background: 'var(--clr-bg-mid)',
                fontSize: '0.85rem',
              }}
            />
          </div>

          {/* ─── PROFILE FIELDS ─── */}
          <div style={{ background: 'var(--clr-bg-mid)', border: '1px solid var(--clr-border)', borderRadius: '14px', padding: '1.1rem 1.25rem', marginBottom: '1.25rem', display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>

            {/* Phone Number */}
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem', color: 'var(--clr-text-heading)' }}>
                📞 Phone Number
              </label>
              <input
                id="worker-phone-input"
                type="tel"
                placeholder="e.g. +91 98220 12345"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid var(--clr-border)', background: '#fff', fontSize: '0.87rem' }}
              />
            </div>

            {/* Date of Birth */}
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem', color: 'var(--clr-text-heading)' }}>
                🎂 Date of Birth
              </label>
              <input
                id="worker-dob-input"
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                max={new Date(new Date().setFullYear(new Date().getFullYear() - 20)).toISOString().slice(0, 10)}
                style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid var(--clr-border)', background: '#fff', fontSize: '0.87rem' }}
              />
            </div>

            {/* Years of Experience */}
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem', color: 'var(--clr-text-heading)' }}>
                📅 Years of Experience
              </label>
              <select
                id="worker-experience-select"
                value={yearsOfExperience}
                onChange={(e) => setYearsOfExperience(e.target.value)}
                style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid var(--clr-border)', background: '#fff', fontSize: '0.87rem' }}
              >
                <option value="">Select experience</option>
                <option value="0">Less than 1 year</option>
                <option value="1">1–2 years</option>
                <option value="3">3–5 years</option>
                <option value="6">6–10 years</option>
                <option value="11">10+ years</option>
              </select>
            </div>
          </div>

          {/* Short Bio */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem', color: 'var(--clr-text-heading)' }}>
              📝 Short Bio <span style={{ fontWeight: 400, color: '#64748b' }}>(max 300 chars)</span>
            </label>
            <textarea
              id="worker-bio-input"
              rows={3}
              maxLength={300}
              placeholder="Tell employers a little about yourself, your work style, and what you specialise in..."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '10px', border: '1px solid var(--clr-border)', background: '#fff', fontSize: '0.87rem', resize: 'vertical', lineHeight: 1.5 }}
            />
            <div style={{ fontSize: '0.75rem', color: bio.length > 270 ? '#e11d48' : '#94a3b8', textAlign: 'right', marginTop: '0.2rem' }}>
              {bio.length} / 300
            </div>
          </div>

          {skillsMsg && (
            <div className={`alert ${skillsMsg.type === 'error' ? 'alert-error' : 'alert-success'}`}>
              <span>{skillsMsg.type === 'error' ? '⚠️' : '✅'}</span>
              {skillsMsg.text}
            </div>
          )}

          <button
            id="save-skills-btn"
            className="btn-primary"
            onClick={handleSaveSkills}
            disabled={skillsSaving}
            style={{ maxWidth: 240 }}
          >
            {skillsSaving ? (
              <><span className="btn-spinner" />Saving…</>
            ) : skillsDone ? (
              '✓ Profile Saved'
            ) : (
              'Save Skills →'
            )}
          </button>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 2 — SKILL / ITI CERTIFICATE VERIFICATION (QR PARSING)
        ══════════════════════════════════════════════════════════════════ */}
        <div className="profile-section">
          <CertificateUpload
            currentStatus={verificationStatus}
            onVerified={(data) => {
              setVerificationStatus(data.verificationStatus);
              if (data.verificationStatus === 'verified') {
                setVerifyDone(true);
              }
            }}
          />

          <div style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              id="go-dashboard-btn"
              className="btn-primary"
              onClick={() => navigate('/worker/dashboard')}
              style={{
                maxWidth: 260,
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              }}
            >
              Finish &amp; Go to Dashboard →
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
