const TONE_VARS = {
  green:  { bg: 'rgba(16,185,129,0.10)', icon: 'rgba(16,185,129,0.18)', text: '#047857', val: '#10b981' },
  indigo: { bg: 'rgba(99,102,241,0.10)', icon: 'rgba(99,102,241,0.18)', text: '#4338ca', val: '#6366f1' },
  amber:  { bg: 'rgba(245,158,11,0.10)', icon: 'rgba(245,158,11,0.18)', text: '#b45309', val: '#f59e0b' },
  slate:  { bg: 'rgba(100,116,139,0.10)', icon: 'rgba(100,116,139,0.18)', text: '#475569', val: '#64748b' },
  rose:   { bg: 'rgba(239,68,68,0.10)', icon: 'rgba(239,68,68,0.18)', text: '#b91c1c', val: '#ef4444' },
};

export default function StatChip({ icon, label, value, tone = 'slate', onClick, id }) {
  const t = TONE_VARS[tone] || TONE_VARS.slate;
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      id={id}
      className="fc-stat"
      onClick={onClick}
      style={{
        background: t.bg,
        border: `1px solid ${t.icon}`,
        cursor: onClick ? 'pointer' : 'default',
        '--fc-stat-icon-bg': t.icon,
        '--fc-stat-val-clr': t.val,
        '--fc-stat-txt-clr': t.text,
      }}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => (e.key === 'Enter' || e.key === ' ') && onClick(e) : undefined}
    >
      <div className="fc-stat-icon">{icon}</div>
      <div className="fc-stat-body">
        <div className="fc-stat-value">{value}</div>
        <div className="fc-stat-label">{label}</div>
      </div>
    </Tag>
  );
}