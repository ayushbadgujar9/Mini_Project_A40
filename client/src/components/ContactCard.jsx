import { useState, useEffect, useCallback } from 'react';

const API = 'http://localhost:5000';

/**
 * ContactCard
 *
 * Fetches and displays the other party's contact details for an accepted/
 * completed application. Only reveals name, phone, email, and city.
 *
 * Props:
 *   applicationId – the application _id
 *   token         – JWT auth token
 */
export default function ContactCard({ applicationId, token }) {
  const [contact, setContact] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  const fetchContact = useCallback(async () => {
    if (!applicationId || !token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/applications/${applicationId}/contact`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load contact.');
      setContact(data.contact);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [applicationId, token]);

  useEffect(() => { fetchContact(); }, [fetchContact]);

  const handleCopy = () => {
    if (!contact?.phoneNumber) return;
    navigator.clipboard.writeText(contact.phoneNumber).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (loading) {
    return (
      <div style={styles.card}>
        <div style={styles.shimmer} />
        <div style={{ ...styles.shimmer, width: '60%', marginTop: 8 }} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ ...styles.card, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
        <p style={{ margin: 0, color: '#b91c1c', fontSize: '0.85rem', fontWeight: 600 }}>
          ⚠️ {error}
        </p>
      </div>
    );
  }

  if (!contact) return null;

  return (
    <div style={styles.card}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.85rem' }}>
        <div style={styles.avatar}>
          {contact.role === 'employer' ? '🏢' : '👷'}
        </div>
        <div>
          <div style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>{contact.name}</div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'capitalize' }}>
            {contact.role}{contact.city ? ` · ${contact.city}` : ''}
          </div>
        </div>
        <span style={styles.unlockedBadge}>🔓 Unlocked</span>
      </div>

      {/* Phone */}
      {contact.phoneNumber ? (
        <div style={styles.contactRow}>
          <span style={styles.contactLabel}>📞</span>
          <a href={`tel:${contact.phoneNumber}`} style={styles.contactLink}>
            {contact.phoneNumber}
          </a>
          <button
            id={`copy-phone-btn-${applicationId}`}
            onClick={handleCopy}
            style={styles.copyBtn}
            title="Copy number"
          >
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>
      ) : (
        <div style={{ ...styles.contactRow, color: '#94a3b8', fontSize: '0.8rem' }}>
          📞 No phone number on file
        </div>
      )}

      {/* Email */}
      {contact.email && (
        <div style={styles.contactRow}>
          <span style={styles.contactLabel}>✉️</span>
          <a href={`mailto:${contact.email}`} style={styles.contactLink}>
            {contact.email}
          </a>
        </div>
      )}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = {
  card: {
    background: '#f0fdf4',
    border: '1px solid #bbf7d0',
    borderRadius: 12,
    padding: '1rem 1.25rem',
  },
  shimmer: {
    height: 16,
    borderRadius: 6,
    background: 'linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.4s infinite',
    width: '80%',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: '50%',
    background: '#dcfce7',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.25rem',
    flexShrink: 0,
  },
  unlockedBadge: {
    marginLeft: 'auto',
    fontSize: '0.7rem',
    fontWeight: 700,
    color: '#15803d',
    background: '#dcfce7',
    border: '1px solid #bbf7d0',
    borderRadius: 9999,
    padding: '0.15rem 0.6rem',
  },
  contactRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginTop: '0.5rem',
  },
  contactLabel: {
    fontSize: '0.9rem',
    flexShrink: 0,
  },
  contactLink: {
    fontSize: '0.88rem',
    fontWeight: 600,
    color: '#0369a1',
    textDecoration: 'none',
    flex: 1,
    wordBreak: 'break-all',
  },
  copyBtn: {
    fontSize: '0.72rem',
    fontWeight: 700,
    color: '#047857',
    background: '#dcfce7',
    border: '1px solid #bbf7d0',
    borderRadius: 6,
    padding: '0.2rem 0.6rem',
    cursor: 'pointer',
    flexShrink: 0,
  },
};
