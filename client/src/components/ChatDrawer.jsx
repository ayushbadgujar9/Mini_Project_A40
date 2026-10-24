import { useState, useEffect, useRef, useCallback } from 'react';
import ContactCard from './ContactCard';
import ChatBox from './ChatBox';

const API = 'http://localhost:5000';
const UNREAD_POLL_INTERVAL = 15000; // 15 seconds

/**
 * useChatUnreadCounts
 *
 * Hook that polls /api/chat/unread-counts every 15 seconds and returns
 * { [applicationId]: number }.
 *
 * Usage: const counts = useChatUnreadCounts(token);
 */
export function useChatUnreadCounts(token) {
  const [counts, setCounts] = useState({});
  const timer = useRef(null);

  const fetch_ = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API}/api/chat/unread-counts`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCounts(data);
      }
    } catch {
      // Non-critical
    }
  }, [token]);

  useEffect(() => {
    fetch_();
    timer.current = setInterval(fetch_, UNREAD_POLL_INTERVAL);
    return () => clearInterval(timer.current);
  }, [fetch_]);

  return counts;
}

// ─────────────────────────────────────────────────────────────────────────────
// ChatButton
//
// The trigger button shown on accepted/completed application rows.
// Shows an unread badge if there are unread messages.
// ─────────────────────────────────────────────────────────────────────────────
export function ChatButton({ applicationId, unreadCount = 0, onClick, label = '💬 Chat' }) {
  return (
    <button
      id={`chat-btn-${applicationId}`}
      onClick={onClick}
      style={{
        position: 'relative',
        padding: '0.5rem 1rem',
        borderRadius: 10,
        border: '1px solid #34d399',
        background: 'rgba(16,185,129,0.08)',
        color: '#047857',
        fontWeight: 700,
        fontSize: '0.82rem',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.35rem',
        transition: 'all 150ms',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(16,185,129,0.15)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'rgba(16,185,129,0.08)';
      }}
    >
      {label}
      {unreadCount > 0 && (
        <span style={{
          position: 'absolute',
          top: -6,
          right: -6,
          minWidth: 18,
          height: 18,
          borderRadius: 9999,
          background: '#ef4444',
          color: '#fff',
          fontSize: '0.65rem',
          fontWeight: 800,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 4px',
        }}>
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LockedChatHint
//
// Shown in place of the Chat button when the application is not yet accepted.
// ─────────────────────────────────────────────────────────────────────────────
export function LockedChatHint() {
  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.35rem',
      padding: '0.45rem 0.9rem',
      borderRadius: 10,
      border: '1px solid #e2e8f0',
      background: '#f8fafc',
      color: '#94a3b8',
      fontSize: '0.78rem',
      fontWeight: 600,
    }}>
      🔒 Contact details unlock after the offer is accepted.
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ChatDrawer
//
// A slide-in drawer (full-screen on mobile, right-panel on desktop) that
// shows ContactCard on top and ChatBox below.
//
// Props:
//   open           – boolean
//   onClose        – () => void
//   applicationId  – string
//   token          – string (JWT)
//   myUserId       – string
//   otherPartyName – string
//   isReadOnly     – boolean (true when job is completed)
// ─────────────────────────────────────────────────────────────────────────────
export default function ChatDrawer({
  open,
  onClose,
  applicationId,
  token,
  myUserId,
  otherPartyName,
  isReadOnly = false,
}) {
  // Prevent body scroll when drawer is open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.45)',
          zIndex: 9000,
          backdropFilter: 'blur(2px)',
        }}
      />

      {/* Panel */}
      <div style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: 'min(420px, 100vw)',
        background: '#ffffff',
        zIndex: 9001,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '-4px 0 24px rgba(0,0,0,0.15)',
        animation: 'slideInRight 200ms ease-out',
      }}>

        {/* ── Drawer Header ──────────────────────────────────────────────── */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1rem 1.25rem',
          borderBottom: '1px solid #e2e8f0',
          background: '#f8fafc',
          flexShrink: 0,
        }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1rem', color: '#0f172a' }}>
              💬 Chat with {otherPartyName}
            </div>
            {isReadOnly && (
              <div style={{ fontSize: '0.72rem', color: '#92400e', marginTop: 2 }}>
                🔒 Job completed — read-only
              </div>
            )}
          </div>
          <button
            id="chat-drawer-close-btn"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '1rem',
              color: '#475569',
            }}
          >
            ✕
          </button>
        </div>

        {/* ── Contact Card ───────────────────────────────────────────────── */}
        <div style={{ padding: '0.85rem 1rem 0', flexShrink: 0 }}>
          <ContactCard applicationId={applicationId} token={token} />
        </div>

        {/* ── Divider ────────────────────────────────────────────────────── */}
        <div style={{
          margin: '0.65rem 1rem',
          borderTop: '1px dashed #e2e8f0',
          flexShrink: 0,
        }} />

        {/* ── ChatBox (fills remaining height) ───────────────────────────── */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <ChatBox
            applicationId={applicationId}
            token={token}
            myUserId={myUserId}
            otherPartyName={otherPartyName}
            isReadOnly={isReadOnly}
          />
        </div>
      </div>

      {/* Inline keyframes */}
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);   opacity: 1; }
        }
        @keyframes shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </>
  );
}
