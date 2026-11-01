import { useState, useEffect, useRef } from 'react';

export default function DropdownMenu({ trigger, items = [], align = 'right', label = 'Menu' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const visible = items.filter((it) => !it.hidden);

  return (
    <div className="fc-menu" ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <span
        onClick={() => setOpen((p) => !p)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}
      >
        {trigger}
      </span>
      {open && (
        <ul
          className="fc-menu-list"
          role="menu"
          style={{ [align === 'right' ? 'right' : 'left']: 0 }}
        >
          {visible.map((item, i) => (
            <li key={i} role="none">
              <button
                className={`fc-menu-item${item.danger ? ' fc-menu-item--danger' : ''}`}
                role="menuitem"
                onClick={() => { setOpen(false); item.onClick?.(); }}
              >
                {item.icon && <span style={{ width: '1.25em', display: 'inline-block' }}>{item.icon}</span>}
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}