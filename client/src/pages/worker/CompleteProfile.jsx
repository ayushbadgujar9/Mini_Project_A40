import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

// ── Skill catalogue ──────────────────────────────────────────────────────────
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

const API = 'http://localhost:5000';

export default function CompleteProfile() {
  const { token } = useAuth();
  const navigate   = useNavigate();

  // ── Skill state ────────────────────────────────────────────────────────────
  const [selectedSkills, setSelectedSkills] = useState([]);
  const [skillsSaving,   setSkillsSaving]   = useState(false);
  const [skillsMsg,      setSkillsMsg]       = useState(null); // { type, text }

  // ── ID upload state ────────────────────────────────────────────────────────
  const [idFile,        setIdFile]        = useState(null);
  const [dragOver,      setDragOver]      = useState(false);
  const [verifying,     setVerifying]     = useState(false);
  const [verifyResult,  setVerifyResult]  = useState(null); // { verified, message }
  const fileInputRef = useRef(null);

  // ── Step tracker ───────────────────────────────────────────────────────────
  const [skillsDone, setSkillsDone] = useState(false);
  const [verifyDone, setVerifyDone] = useState(false);

  // ── Skill toggle ───────────────────────────────────────────────────────────
  const toggleSkill = (id) => {
    setSelectedSkills((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  // ── Save skills ────────────────────────────────────────────────────────────
  const handleSaveSkills = async () => {
    if (selectedSkills.length === 0) {
      setSkillsMsg({ type: 'error', text: 'Please select at least one skill.' });
      return;
    }
    setSkillsSaving(true);
    setSkillsMsg(null);
    try {
      const res = await fetch(`${API}/api/worker/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          skills: selectedSkills,
          primarySkill: selectedSkills[0],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setSkillsMsg({ type: 'success', text: '✅ Skills saved successfully!' });
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
    setIdFile(file);
    setVerifyResult(null);
  };

  // ── Submit ID for OCR ──────────────────────────────────────────────────────
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

      setVerifyResult({ verified: data.verified, message: data.message });
      setVerifyDone(true);

      // Redirect after both actions are complete
      if (skillsDone) {
        setTimeout(() => navigate('/worker/dashboard'), 1500);
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
            Two quick steps to unlock all job opportunities on FairConnect.
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
            <span className={`step-label ${stepState(verifyDone, skillsDone)}`}>Verify ID</span>
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
            <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1rem' }}>
              {selectedSkills.length} skill{selectedSkills.length > 1 ? 's' : ''} selected
              {selectedSkills.length > 0 && (
                <> · Primary: <strong style={{ color: '#a5b4fc' }}>
                  {SKILLS.find((s) => s.id === selectedSkills[0])?.label}
                </strong></>
              )}
            </p>
          )}

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
            SECTION 2 — ID VERIFICATION
        ══════════════════════════════════════════════════════════════════ */}
        <div className="profile-section">
          <div className="section-header">
            <div className="section-icon">🪪</div>
            <div>
              <div className="section-title">AI-Powered ID Verification</div>
              <div className="section-subtitle">
                Upload a government-issued ID — our AI reads and validates it instantly
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
              accept="image/jpeg,image/png"
              onChange={(e) => handleFileChange(e.target.files?.[0])}
              style={{ display: 'none' }}
            />
            <div className="upload-icon">{idFile ? '📄' : '📂'}</div>
            <div className="upload-label">
              {idFile ? idFile.name : 'Click or drag & drop your ID here'}
            </div>
            <div className="upload-hint">
              Aadhar, Passport, Voter ID, Driving Licence · JPEG / PNG · max 5 MB
            </div>
          </div>

          {/* File selected preview */}
          {idFile && !verifying && !verifyResult && (
            <div className="upload-preview">
              <span>🖼️</span>
              <span className="upload-preview-name">{idFile.name}</span>
              <button
                type="button"
                style={{ background: 'none', border: 'none', color: '#f43f5e', fontSize: '1rem', cursor: 'pointer' }}
                onClick={() => setIdFile(null)}
                aria-label="Remove file"
              >✕</button>
            </div>
          )}

          {/* AI loading state */}
          {verifying && (
            <div className="ai-loading">
              <div className="ai-dots">
                <span /><span /><span />
              </div>
              <span className="ai-loading-text">🤖 AI is reading your ID…</span>
            </div>
          )}

          {/* Verification result */}
          {verifyResult && (
            <div className={`alert ${verifyResult.verified ? 'alert-success' : 'alert-error'}`}
              style={{ marginBottom: '1rem' }}>
              <span>{verifyResult.verified ? '✅' : '⚠️'}</span>
              {verifyResult.message}
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              id="verify-id-btn"
              className="btn-primary"
              onClick={handleVerify}
              disabled={verifying || verifyDone || !idFile}
              style={{ maxWidth: 260 }}
            >
              {verifying ? (
                <><span className="btn-spinner" />Verifying…</>
              ) : verifyDone ? (
                '✓ Verification Complete'
              ) : (
                '🔍 Upload & Verify ID'
              )}
            </button>

            {verifyDone && skillsDone && (
              <button
                id="go-dashboard-btn"
                className="btn-primary"
                onClick={() => navigate('/worker/dashboard')}
                style={{ maxWidth: 200, background: 'linear-gradient(135deg, #34d399 0%, #059669 100%)' }}
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
