import { useEffect, useRef } from 'react';

// Shared close-on-Escape + body scroll lock
function useOverlay(open, onClose) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);
}

/* ── Drawer (right slide-over) ───────────────────────────────────────────── */
export function Drawer({ open, onClose, title, subtitle, icon, children, footer, id }) {
  useOverlay(open, onClose);
  if (!open) return null;
  return (
    <div
      className="fc-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      aria-hidden="true"
    >
      <div
        id={id}
        className="fc-panel fc-panel--drawer"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="fc-panel-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            {icon && <span style={{ fontSize: '1.25rem' }}>{icon}</span>}
            <div>
              {title && <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--clr-text-heading)' }}>{title}</div>}
              {subtitle && <div style={{ fontSize: '0.8rem', color: 'var(--clr-text-muted)', marginTop: '0.1rem' }}>{subtitle}</div>}
            </div>
          </div>
          <button
            className="fc-icon-btn"
            onClick={onClose}
            aria-label="Close"
            style={{ marginLeft: 'auto' }}
          >
            ✕
          </button>
        </div>
        <div className="fc-panel-body">{children}</div>
        {footer && <div className="fc-panel-foot">{footer}</div>}
      </div>
    </div>
  );
}

/* ── Modal (centred dialog) ─────────────────────────────────────────────── */
export function Modal({ open, onClose, title, subtitle, icon, children, footer, id }) {
  useOverlay(open, onClose);
  if (!open) return null;
  return (
    <div
      className="fc-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      aria-hidden="true"
    >
      <div
        id={id}
        className="fc-panel fc-panel--modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="fc-panel-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            {icon && <span style={{ fontSize: '1.25rem' }}>{icon}</span>}
            <div>
              {title && <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--clr-text-heading)' }}>{title}</div>}
              {subtitle && <div style={{ fontSize: '0.82rem', color: 'var(--clr-text-muted)', marginTop: '0.1rem' }}>{subtitle}</div>}
            </div>
          </div>
          <button
            className="fc-icon-btn"
            onClick={onClose}
            aria-label="Close"
            style={{ marginLeft: 'auto' }}
          >
            ✕
          </button>
        </div>
        <div className="fc-panel-body">{children}</div>
        {footer && <div className="fc-panel-foot">{footer}</div>}
      </div>
    </div>
  );
}