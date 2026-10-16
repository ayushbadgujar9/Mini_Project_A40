import { useState, useRef, useEffect } from 'react';
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
  const { token, user } = useAuth();
  const navigate = useNavigate();

  // ── Skill state ────────────────────────────────────────────────────────────
  const [selectedSkills, setSelectedSkills] = useState([]);
  const [skillsSaving,   setSkillsSaving]   = useState(false);
  const [skillsMsg,      setSkillsMsg]       = useState(null); // { type, text }

  // ── Email Verification State ───────────────────────────────────────────────
  const [email,          setEmail]          = useState(user?.email || '');
  const [otpSent,        setOtpSent]        = useState(false);
  const [otpDigits,      setOtpDigits]      = useState(['', '', '', '', '', '']);
  const [emailSending,   setEmailSending]   = useState(false);
  const [verifyingOtp,   setVerifyingOtp]   = useState(false);
  const [verifyMsg,      setVerifyMsg]      = useState(null); // { type, text }
  const [countdown,      setCountdown]      = useState(300);
  const [timerActive,    setTimerActive]    = useState(false);
  const digitRefs = useRef([]);

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
        if (data.email) setEmail(data.email);
        if (data.skills && data.skills.length > 0) {
          setSelectedSkills(data.skills);
          setSkillsDone(true);
        }
        if (data.isEmailVerified || data.isVerified) {
          setVerifyDone(true);
        }
      })
      .catch(() => {});
  }, [token]);

  // Countdown timer
  useEffect(() => {
    let interval = null;
    if (timerActive && countdown > 0) {
      interval = setInterval(() => setCountdown((c) => c - 1), 1000);
    } else if (countdown === 0) {
      setTimerActive(false);
    }
    return () => clearInterval(interval);
  }, [timerActive, countdown]);

  const formatTimer = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

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

      // Redirect if both steps complete
      if (verifyDone) {
        setTimeout(() => navigate('/worker/dashboard'), 1200);
      }
    } catch (err) {
      setSkillsMsg({ type: 'error', text: err.message });
    } finally {
      setSkillsSaving(false);
    }
  };

  // ── Send Email OTP ─────────────────────────────────────────────────────────
  const handleSendEmailOtp = async () => {
    setVerifyMsg(null);
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      setVerifyMsg({ type: 'error', text: 'Please enter a valid email address.' });
      return;
    }

    setEmailSending(true);
    try {
      const res = await fetch(`${API}/api/auth/send-email-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email: cleanEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      setOtpSent(true);
      setCountdown(data.expiresInSeconds || 300);
      setTimerActive(true);
      if (data.devOtp) {
        setOtpDigits(data.devOtp.split(''));
        setVerifyMsg({ type: 'success', text: `Demo Code: ${data.devOtp} (Auto-filled. Add SMTP in server/.env for real inbox emails)` });
      } else {
        setVerifyMsg({ type: 'success', text: `Verification code sent to ${cleanEmail}!` });
        setOtpDigits(['', '', '', '', '', '']);
      }
      setTimeout(() => digitRefs.current[0]?.focus(), 150);
    } catch (err) {
      setVerifyMsg({ type: 'error', text: err.message });
    } finally {
      setEmailSending(false);
    }
  };

  // ── Digit input handlers ───────────────────────────────────────────────────
  const handleDigitChange = (index, value) => {
    const clean = value.replace(/\D/g, '').slice(-1);
    const next = [...otpDigits];
    next[index] = clean;
    setOtpDigits(next);

    if (clean && index < 5) {
      digitRefs.current[index + 1]?.focus();
    }

    const code = next.join('');
    if (code.length === 6) {
      handleConfirmOtp(code);
    }
  };

  const handleDigitKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      digitRefs.current[index - 1]?.focus();
    }
  };

  // ── Confirm OTP ────────────────────────────────────────────────────────────
  const handleConfirmOtp = async (codeOverride) => {
    setVerifyMsg(null);
    const code = codeOverride || otpDigits.join('');
    if (code.length !== 6) {
      setVerifyMsg({ type: 'error', text: 'Please enter all 6 digits of the code.' });
      return;
    }

    setVerifyingOtp(true);
    try {
      const res = await fetch(`${API}/api/auth/confirm-email-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ otp: code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      setVerifyMsg({ type: 'success', text: '🎉 Email verified! Your worker profile is now verified.' });
      setVerifyDone(true);

      if (skillsDone) {
        setTimeout(() => navigate('/worker/dashboard'), 1500);
      }
    } catch (err) {
      setVerifyMsg({ type: 'error', text: err.message });
    } finally {
      setVerifyingOtp(false);
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
            Skip for now
          </button>
        </header>

        {/* ── Page heading ── */}
        <div style={{ marginBottom: '1.75rem' }}>
          <h1 className="page-title" style={{ marginBottom: '0.3rem' }}>Complete Your Profile</h1>
          <p className="page-subtitle" style={{ marginBottom: 0 }}>
            Two quick steps to unlock verified job opportunities on FairConnect.
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
            <span className={`step-label ${stepState(verifyDone, skillsDone)}`}>Verify Email (OTP)</span>
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
            SECTION 2 — REAL-TIME EMAIL OTP VERIFICATION
        ══════════════════════════════════════════════════════════════════ */}
        <div className="profile-section">
          <div className="section-header">
            <div className="section-icon">📧</div>
            <div>
              <div className="section-title">Email OTP Verification</div>
              <div className="section-subtitle">
                Verify your email address with a 6-digit real-time code to become a verified worker
              </div>
            </div>
          </div>

          {verifyMsg && (
            <div className={`alert ${verifyMsg.type === 'error' ? 'alert-error' : 'alert-success'}`} style={{ marginBottom: '1.2rem' }}>
              <span>{verifyMsg.type === 'error' ? '⚠️' : '✅'}</span>
              {verifyMsg.text}
            </div>
          )}

          {verifyDone ? (
            <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: 12, padding: '1.5rem', textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🛡️</div>
              <h3 style={{ margin: '0 0 0.5rem', color: '#34d399', fontSize: '1.2rem', fontWeight: 700 }}>Profile Verified</h3>
              <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.9rem' }}>
                Your email ({email}) is verified. You now enjoy priority ranking and direct job matches!
              </p>
            </div>
          ) : (
            <div>
              <div style={{ marginBottom: '1.2rem' }}>
                <label className="form-label" htmlFor="profile-email-input">
                  Your Email Address
                </label>
                <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                  <input
                    id="profile-email-input"
                    type="email"
                    className="form-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="worker@example.com"
                    style={{ flex: 1, minWidth: '220px' }}
                    disabled={otpSent && timerActive}
                  />
                  <button
                    type="button"
                    id="send-profile-otp-btn"
                    className="btn-secondary"
                    onClick={handleSendEmailOtp}
                    disabled={emailSending || !email.trim()}
                    style={{ minWidth: '150px' }}
                  >
                    {emailSending ? <span className="btn-spinner" /> : otpSent ? 'Resend Code' : 'Send Code 📨'}
                  </button>
                </div>
              </div>

              {otpSent && (
                <div style={{ background: 'rgba(15, 23, 42, 0.4)', borderRadius: 12, padding: '1.2rem', border: '1px solid rgba(255,255,255,0.08)', marginBottom: '1.2rem' }}>
                  <label className="form-label" style={{ display: 'block', textAlign: 'center', marginBottom: '0.8rem' }}>
                    Enter 6-Digit Code (Sent to {email})
                  </label>
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginBottom: '1rem' }}>
                    {otpDigits.map((digit, idx) => (
                      <input
                        key={idx}
                        ref={(el) => (digitRefs.current[idx] = el)}
                        id={`complete-otp-${idx}`}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleDigitChange(idx, e.target.value)}
                        onKeyDown={(e) => handleDigitKeyDown(idx, e)}
                        className="form-input"
                        style={{
                          width: '42px',
                          height: '52px',
                          textAlign: 'center',
                          fontSize: '1.5rem',
                          fontWeight: 800,
                          padding: 0,
                          borderRadius: '8px',
                          background: 'rgba(15, 23, 42, 0.8)',
                          borderColor: digit ? '#10b981' : 'rgba(255,255,255,0.15)',
                          color: '#ffffff',
                        }}
                      />
                    ))}
                  </div>

                  <div style={{ textAlign: 'center', marginBottom: '1rem', fontSize: '0.85rem', color: '#94a3b8' }}>
                    {timerActive ? (
                      <>Code valid for: <strong style={{ color: countdown < 60 ? '#f43f5e' : '#34d399' }}>{formatTimer(countdown)}</strong></>
                    ) : (
                      <span style={{ color: '#f43f5e', fontWeight: 600 }}>Code expired. Click Resend Code.</span>
                    )}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <button
                      type="button"
                      id="verify-profile-otp-btn"
                      className="btn-primary"
                      onClick={() => handleConfirmOtp()}
                      disabled={verifyingOtp || otpDigits.join('').length !== 6}
                      style={{ maxWidth: '240px' }}
                    >
                      {verifyingOtp ? <><span className="btn-spinner" />Verifying…</> : 'Verify & Complete Profile'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {verifyDone && skillsDone && (
            <div style={{ marginTop: '1.5rem' }}>
              <button
                id="go-dashboard-btn"
                className="btn-primary"
                onClick={() => navigate('/worker/dashboard')}
                style={{ maxWidth: 240, background: 'linear-gradient(135deg, #34d399 0%, #059669 100%)' }}
              >
                Go to Dashboard →
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
