import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

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

  // ── ID upload & OCR state ──────────────────────────────────────────────────
  const [idFile,        setIdFile]        = useState(null);
  const [idPreviewUrl,  setIdPreviewUrl]  = useState(null);
  const [dragOver,      setDragOver]      = useState(false);
  const [verifying,     setVerifying]     = useState(false);
  const [verifyResult,  setVerifyResult]  = useState(null); // { verified, message, ocrText, status }
  const fileInputRef = useRef(null);

  // ── Step tracker ───────────────────────────────────────────────────────────
  const [skillsDone, setSkillsDone] = useState(false);
  const [verifyDone, setVerifyDone] = useState(false);

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
        if (data.city) {
          setCity(data.city);
        }
        if (data.isVerified || data.verificationStatus === 'verified') {
          setVerifyDone(true);
          setVerifyResult({
            verified: true,
            status: 'verified',
            message: 'Your profile is already ID verified!',
          });
        } else if (data.verificationStatus === 'pending') {
          setVerifyResult({
            verified: false,
            status: 'pending',
            message: 'Your ID is currently under manual review by the admin team.',
          });
        }
      })
      .catch(() => {});
  }, [token]);

  // Clean up object URLs
  useEffect(() => {
    return () => {
      if (idPreviewUrl) URL.revokeObjectURL(idPreviewUrl);
    };
  }, [idPreviewUrl]);

  // ── Skill toggle ───────────────────────────────────────────────────────────
  const toggleSkill = (id) => {
    setSelectedSkills((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  // ── Save skills & city ─────────────────────────────────────────────────────
  const handleSaveSkills = async () => {
    if (selectedSkills.length === 0) {
      setSkillsMsg({ type: 'error', text: 'Please select at least one skill.' });
      return;
    }
    setSkillsSaving(true);
    setSkillsMsg(null);
    try {
      const payload = {
        skills: selectedSkills,
        primarySkill: selectedSkills[0],
      };
      if (city.trim()) {
        payload.city = city.trim();
      }

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

      setSkillsMsg({ type: 'success', text: '✅ Skills and location saved successfully!' });
      setSkillsDone(true);

      // Redirect after both actions are complete
      if (verifyDone) {
        setTimeout(() => navigate('/worker/dashboard'), 1200);
      }
    } catch (err) {
      setSkillsMsg({ type: 'error', text: err.message });
    } finally {
      setSkillsSaving(false);
    }
  };

  // ── Handle file selection ──────────────────────────────────────────────────
  const handleFileChange = (file) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/jpg'].includes(file.type)) {
      setVerifyResult({ verified: false, message: 'Only JPEG or PNG images are accepted.' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setVerifyResult({ verified: false, message: 'File must be under 5 MB.' });
      return;
    }
    if (idPreviewUrl) URL.revokeObjectURL(idPreviewUrl);
    setIdFile(file);
    setIdPreviewUrl(URL.createObjectURL(file));
    setVerifyResult(null);
  };

  // ── Submit ID for OCR Verification ─────────────────────────────────────────
  const handleVerify = async () => {
    if (!idFile) {
      setVerifyResult({ verified: false, message: 'Please select an ID image first.' });
      return;
    }
    setVerifying(true);
    setVerifyResult(null);

    try {
      const formData = new FormData();
      formData.append('idImage', idFile);

      const res = await fetch(`${API}/api/worker/verify`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      setVerifyResult({
        verified: data.verified || data.isVerified,
        status: data.verificationStatus || (data.verified ? 'verified' : 'pending'),
        message: data.message,
        ocrText: data.ocrExtractedText || null,
      });

      setVerifyDone(true);

      // Redirect after both actions are complete
      if (skillsDone) {
        setTimeout(() => navigate('/worker/dashboard'), 2000);
      }
    } catch (err) {
      setVerifyResult({ verified: false, message: err.message });
    } finally {
      setVerifying(false);
    }
  };

  // ── Drag & drop handlers ───────────────────────────────────────────────────
  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileChange(file);
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
            Skip for now
          </button>
        </header>

        {/* ── Page heading ── */}
        <div style={{ marginBottom: '1.75rem' }}>
          <h1 className="page-title" style={{ marginBottom: '0.3rem' }}>Complete Your Profile</h1>
          <p className="page-subtitle" style={{ marginBottom: 0 }}>
            Two quick steps to unlock verified job opportunities and boost your fairness score.
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
            <span className={`step-label ${stepState(verifyDone, skillsDone)}`}>Verify ID (AI OCR)</span>
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
            disabled={skillsSaving || skillsDone}
            style={{ maxWidth: 240 }}
          >
            {skillsSaving ? (
              <><span className="btn-spinner" />Saving…</>
            ) : skillsDone ? (
              '✓ Skills Saved'
            ) : (
              'Save Skills →'
            )}
          </button>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 2 — AI-POWERED ID OCR VERIFICATION
        ══════════════════════════════════════════════════════════════════ */}
        <div className="profile-section">
          <div className="section-header">
            <div className="section-icon">🪪</div>
            <div>
              <div className="section-title">AI-Powered ID Verification</div>
              <div className="section-subtitle">
                Upload a government-issued ID — our OCR AI reads and validates it instantly (+20 Fairness bonus)
              </div>
            </div>
          </div>

          {/* Drop zone */}
          <div
            className={`upload-zone ${dragOver ? 'drag-over' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            aria-label="Upload ID image"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              id="id-file-input"
              accept="image/jpeg,image/png,image/jpg"
              onChange={(e) => handleFileChange(e.target.files?.[0])}
              style={{ display: 'none' }}
            />
            <div className="upload-icon">{idFile ? '📄' : '📂'}</div>
            <div className="upload-label">
              {idFile ? idFile.name : 'Click or drag & drop your ID here'}
            </div>
            <div className="upload-hint">
              Aadhaar, Voter ID, Driving Licence, Passport · JPEG / PNG · max 5 MB
            </div>
          </div>

          {/* File selected preview */}
          {idFile && !verifying && (
            <div className="upload-preview" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', overflow: 'hidden' }}>
                {idPreviewUrl ? (
                  <img
                    src={idPreviewUrl}
                    alt="ID preview"
                    style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                ) : (
                  <span style={{ fontSize: '1.5rem' }}>🖼️</span>
                )}
                <div style={{ overflow: 'hidden' }}>
                  <div className="upload-preview-name">{idFile.name}</div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                    {(idFile.size / 1024).toFixed(1)} KB · Ready to scan
                  </div>
                </div>
              </div>
              <button
                type="button"
                style={{ background: 'none', border: 'none', color: '#f43f5e', fontSize: '1.1rem', cursor: 'pointer', padding: '0.25rem 0.5rem' }}
                onClick={(e) => {
                  e.stopPropagation();
                  setIdFile(null);
                  if (idPreviewUrl) URL.revokeObjectURL(idPreviewUrl);
                  setIdPreviewUrl(null);
                  setVerifyResult(null);
                }}
                aria-label="Remove file"
              >✕</button>
            </div>
          )}

          {/* AI OCR loading state */}
          {verifying && (
            <div className="ai-loading">
              <div className="ai-dots">
                <span /><span /><span />
              </div>
              <span className="ai-loading-text">🤖 Tesseract AI is reading and extracting text from your ID…</span>
            </div>
          )}

          {/* Verification result */}
          {verifyResult && (
            <div
              className={`alert ${verifyResult.verified ? 'alert-success' : 'alert-warning'}`}
              style={{ marginBottom: '1rem' }}
            >
              <span>{verifyResult.verified ? '✅' : '⏳'}</span>
              <div>
                <div style={{ fontWeight: 700 }}>
                  {verifyResult.verified
                    ? 'ID Verified Successfully!'
                    : 'ID Submitted For Review'}
                </div>
                <div style={{ fontSize: '0.8rem', marginTop: '0.2rem' }}>
                  {verifyResult.message}
                </div>
              </div>
            </div>
          )}

          {/* OCR Extracted Text Preview (if returned) */}
          {verifyResult?.ocrText && (
            <div className="ocr-result-card">
              <div className="ocr-result-header">
                <span>🔍 OCR Extracted Document Text:</span>
                <span style={{ fontSize: '0.7rem', color: '#64748b' }}>AI Recognition Output</span>
              </div>
              <div className="ocr-snippet">
                {verifyResult.ocrText}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '1rem' }}>
            <button
              id="verify-id-btn"
              className="btn-primary"
              onClick={handleVerify}
              disabled={verifying || (verifyDone && verifyResult?.verified) || !idFile}
              style={{ maxWidth: 280 }}
            >
              {verifying ? (
                <><span className="btn-spinner" />Reading Document…</>
              ) : verifyDone && verifyResult?.verified ? (
                '✓ ID Verified'
              ) : (
                '🔍 Upload & Verify ID with AI'
              )}
            </button>

            {verifyDone && skillsDone && (
              <button
                id="go-dashboard-btn"
                className="btn-primary"
                onClick={() => navigate('/worker/dashboard')}
                style={{ maxWidth: 200, background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
              >
                Go to Dashboard →
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
