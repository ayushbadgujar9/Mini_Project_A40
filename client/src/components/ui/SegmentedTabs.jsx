export default function SegmentedTabs({ tabs = [], value, onChange, ariaLabel }) {
  return (
    <div className="fc-tabs" role="tablist" aria-label={ariaLabel}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          id={`tab-${tab.id}-btn`}
          role="tab"
          aria-selected={value === tab.id}
          className={`fc-tab${value === tab.id ? ' fc-tab--active' : ''}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.icon && <span>{tab.icon}</span>}
          <span>{tab.label}</span>
          {tab.count != null && tab.count > 0 && (
            <span className="fc-tab-count">{tab.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}