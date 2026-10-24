import { useState, useEffect, useRef, useCallback } from 'react';

const API = 'http://localhost:5000';
const POLL_INTERVAL = 4000;   // 4 seconds
const MAX_CHARS     = 1000;
const NEAR_BOTTOM_THRESHOLD = 80; // px from bottom to trigger auto-scroll

/**
 * ChatBox
 *
 * Scrollable chat UI with 4-second short polling, optimistic send, retry on
 * error, auto-scroll, and a character counter. Pauses polling when the tab is
 * hidden. Read-only when the application is 'completed'.
 *
 * Props:
 *   applicationId  – application _id
 *   token          – JWT auth token
 *   myUserId       – logged-in user's id (from AuthContext)
 *   otherPartyName – display name of the other participant
 *   isReadOnly     – boolean, true when job is 'completed'
 */
export default function ChatBox({ applicationId, token, myUserId, otherPartyName, isReadOnly = false }) {
  const [messages,    setMessages]    = useState([]);
  const [text,        setText]        = useState('');
  const [sending,     setSending]     = useState(false);
  const [sendError,   setSendError]   = useState(null);
  const [loadError,   setLoadError]   = useState(null);
  const [initialized, setInitialized] = useState(false);

  const listRef     = useRef(null);
  const afterCursor = useRef(null); // ISO timestamp of last message for incremental polling
  const pollTimer   = useRef(null);

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const isNearBottom = () => {
    if (!listRef.current) return true;
    const { scrollTop, scrollHeight, clientHeight } = listRef.current;
    return scrollHeight - scrollTop - clientHeight < NEAR_BOTTOM_THRESHOLD;
  };

  const scrollToBottom = () => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  };

  // ── Mark messages as read ───────────────────────────────────────────────────
  const markRead = useCallback(async () => {
    if (!token || !applicationId) return;
    try {
      await fetch(`${API}/api/chat/${applicationId}/read`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      // Non-critical — ignore silently
    }
  }, [applicationId, token]);

  // ── Fetch messages (incremental after cursor) ────────────────────────────────
  const fetchMessages = useCallback(async (isInitial = false) => {
    if (!token || !applicationId) return;
    try {
      const url = isInitial
        ? `${API}/api/chat/${applicationId}/messages?limit=50`
        : `${API}/api/chat/${applicationId}/messages?after=${encodeURIComponent(afterCursor.current || '')}&limit=50`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (!res.ok) {
        setLoadError(data.message || 'Failed to load messages.');
        return;
      }

      const incoming = data.messages || [];
      if (incoming.length > 0) {
        const shouldAutoScroll = isNearBottom();
        setMessages((prev) => {
          const existingIds = new Set(prev.map((m) => m._id));
          const newOnes = incoming.filter((m) => !existingIds.has(m._id));
          return newOnes.length ? [...prev, ...newOnes] : prev;
        });
        afterCursor.current = incoming[incoming.length - 1].createdAt;
        if (shouldAutoScroll) {
          // Defer to after render
          setTimeout(scrollToBottom, 0);
        }
        // Mark as read whenever we receive new messages
        markRead();
      }

      if (isInitial) {
        setInitialized(true);
        setTimeout(scrollToBottom, 0);
        markRead();
      }
    } catch {
      if (isInitial) setLoadError('Network error. Check your connection.');
    }
  }, [applicationId, token, markRead]);

  // ── Polling ─────────────────────────────────────────────────────────────────
  const startPolling = useCallback(() => {
    stopPolling();
    pollTimer.current = setInterval(() => {
      if (document.hidden) return; // pause when tab is hidden
      fetchMessages(false);
    }, POLL_INTERVAL);
  }, [fetchMessages]);

  function stopPolling() {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
  }

  useEffect(() => {
    fetchMessages(true);
    startPolling();

    // Pause / resume on visibility change
    const handleVisibility = () => {
      if (document.hidden) stopPolling();
      else {
        fetchMessages(false);
        startPolling();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetchMessages, startPolling]);

  // ── Send message ─────────────────────────────────────────────────────────────
  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || isReadOnly || sending) return;
    if (trimmed.length > MAX_CHARS) return;

    setSending(true);
    setSendError(null);

    // Optimistic: add a temporary message
    const tempId = `temp-${Date.now()}`;
    const optimistic = {
      _id: tempId,
      text: trimmed,
      sender: { _id: myUserId, name: 'You' },
      createdAt: new Date().toISOString(),
      _isOptimistic: true,
    };
    setMessages((prev) => [...prev, optimistic]);
    setText('');
    setTimeout(scrollToBottom, 0);

    try {
      const res = await fetch(`${API}/api/chat/${applicationId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ text: trimmed }),
      });
      const data = await res.json();

      if (!res.ok) {
        // Roll back optimistic message
        setMessages((prev) => prev.filter((m) => m._id !== tempId));
        setSendError(data.message || 'Failed to send.');
        setText(trimmed); // restore draft
        return;
      }

      // Replace optimistic with real message
      const real = data.message;
      setMessages((prev) => prev.map((m) => (m._id === tempId ? real : m)));
      afterCursor.current = real.createdAt;
      setTimeout(scrollToBottom, 0);
    } catch {
      setMessages((prev) => prev.filter((m) => m._id !== tempId));
      setSendError('Network error. Try again.');
      setText(trimmed);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── Format timestamp ─────────────────────────────────────────────────────────
  const formatTime = (iso) => {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={styles.root}>
      {/* Message list */}
      <div ref={listRef} style={styles.messageList}>
        {!initialized && (
          <div style={styles.statusText}>Loading messages…</div>
        )}
        {initialized && messages.length === 0 && (
          <div style={styles.statusText}>
            No messages yet. Say hello to {otherPartyName}!
          </div>
        )}
        {loadError && (
          <div style={{ ...styles.statusText, color: '#ef4444' }}>{loadError}</div>
        )}

        {messages.map((msg) => {
          const isMe = msg.sender?._id?.toString() === myUserId?.toString()
                    || msg._isOptimistic;
          return (
            <div key={msg._id} style={{ ...styles.msgRow, justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
              <div style={{
                ...styles.bubble,
                ...(isMe ? styles.myBubble : styles.theirBubble),
                opacity: msg._isOptimistic ? 0.7 : 1,
              }}>
                {!isMe && (
                  <div style={styles.senderName}>
                    {msg.sender?.name || otherPartyName}
                  </div>
                )}
                <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{msg.text}</div>
                <div style={styles.timestamp}>{formatTime(msg.createdAt)}{msg._isOptimistic ? ' · sending…' : ''}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Read-only banner */}
      {isReadOnly && (
        <div style={styles.readOnlyBanner}>
          🔒 This job is complete — chat is now read-only.
        </div>
      )}

      {/* Input area */}
      {!isReadOnly && (
        <div style={styles.inputArea}>
          <div style={styles.inputWrapper}>
            <textarea
              id={`chat-input-${applicationId}`}
              value={text}
              onChange={(e) => { setText(e.target.value); setSendError(null); }}
              onKeyDown={handleKeyDown}
              placeholder="Type a message… (Enter to send, Shift+Enter for new line)"
              rows={2}
              maxLength={MAX_CHARS}
              disabled={sending}
              style={styles.textarea}
            />
            <div style={styles.inputFooter}>
              <span style={{ fontSize: '0.72rem', color: text.length > 900 ? '#ef4444' : '#94a3b8' }}>
                {text.length}/{MAX_CHARS}
              </span>
              <button
                id={`chat-send-btn-${applicationId}`}
                onClick={handleSend}
                disabled={!text.trim() || sending}
                style={{
                  ...styles.sendBtn,
                  opacity: (!text.trim() || sending) ? 0.5 : 1,
                }}
              >
                {sending ? 'Sending…' : 'Send ↑'}
              </button>
            </div>
          </div>
          {sendError && (
            <div style={styles.errorBanner}>
              ⚠️ {sendError}
              <button onClick={() => { setSendError(null); handleSend(); }} style={styles.retryBtn}>
                Retry
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    minHeight: 0,
  },
  messageList: {
    flex: 1,
    overflowY: 'auto',
    padding: '0.75rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    background: '#f8fafc',
  },
  statusText: {
    textAlign: 'center',
    color: '#94a3b8',
    fontSize: '0.82rem',
    padding: '1.5rem 0',
  },
  msgRow: {
    display: 'flex',
  },
  bubble: {
    maxWidth: '72%',
    borderRadius: 12,
    padding: '0.5rem 0.85rem',
    fontSize: '0.88rem',
    lineHeight: 1.5,
    position: 'relative',
  },
  myBubble: {
    background: '#10b981',
    color: '#fff',
    borderBottomRightRadius: 4,
  },
  theirBubble: {
    background: '#ffffff',
    color: '#0f172a',
    border: '1px solid #e2e8f0',
    borderBottomLeftRadius: 4,
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
  },
  senderName: {
    fontSize: '0.7rem',
    fontWeight: 700,
    color: '#64748b',
    marginBottom: 2,
  },
  timestamp: {
    fontSize: '0.67rem',
    opacity: 0.65,
    marginTop: 3,
    textAlign: 'right',
  },
  readOnlyBanner: {
    background: '#fef3c7',
    borderTop: '1px solid #fde68a',
    color: '#92400e',
    fontSize: '0.8rem',
    fontWeight: 600,
    padding: '0.6rem 1rem',
    textAlign: 'center',
  },
  inputArea: {
    borderTop: '1px solid #e2e8f0',
    background: '#ffffff',
    padding: '0.75rem',
  },
  inputWrapper: {
    border: '1px solid #cbd5e1',
    borderRadius: 10,
    overflow: 'hidden',
    background: '#f8fafc',
  },
  textarea: {
    width: '100%',
    border: 'none',
    resize: 'none',
    padding: '0.65rem 0.85rem',
    fontSize: '0.88rem',
    background: 'transparent',
    outline: 'none',
    fontFamily: 'inherit',
    color: '#0f172a',
    boxSizing: 'border-box',
  },
  inputFooter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 0.75rem 0.5rem',
  },
  sendBtn: {
    background: 'linear-gradient(135deg, #10b981, #059669)',
    color: '#fff',
    border: 'none',
    borderRadius: 7,
    padding: '0.4rem 1rem',
    fontWeight: 700,
    fontSize: '0.82rem',
    cursor: 'pointer',
  },
  errorBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginTop: '0.4rem',
    fontSize: '0.78rem',
    color: '#b91c1c',
    background: 'rgba(239,68,68,0.08)',
    border: '1px solid rgba(239,68,68,0.2)',
    borderRadius: 7,
    padding: '0.4rem 0.75rem',
  },
  retryBtn: {
    marginLeft: 'auto',
    background: 'transparent',
    border: '1px solid rgba(239,68,68,0.4)',
    color: '#b91c1c',
    borderRadius: 5,
    padding: '0.2rem 0.6rem',
    fontSize: '0.75rem',
    cursor: 'pointer',
    fontWeight: 700,
  },
};
