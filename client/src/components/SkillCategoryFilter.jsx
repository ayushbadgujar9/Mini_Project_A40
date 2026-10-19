import React, { useState, useRef, useEffect, useCallback } from 'react';

/**
 * Primary Informal Labor Trade Categories catalogue for FairConnect
 */
export const TRADE_CATEGORIES = [
  {
    id: 'all',
    label: 'All Jobs',
    icon: '💼',
    queryValue: 'All Jobs',
    shortDesc: 'All trade categories & open listings',
    tags: [],
  },
  {
    id: 'construction-masonry',
    label: 'Construction / Masonry',
    icon: '🏗️',
    queryValue: 'Construction / Masonry',
    shortDesc: 'Brickwork, concrete, carpentry & arc welding',
    tags: ['Masonry', 'Concrete', 'Carpentry', 'Welding', 'Brickwork', 'Fabrication'],
  },
  {
    id: 'plumbing',
    label: 'Plumbing',
    icon: '🔧',
    queryValue: 'Plumbing',
    shortDesc: 'Pipe fitting, drainage & leak repairs',
    tags: ['Plumbing', 'Pipe Fitting', 'Leak Repair', 'Drainage', 'Sanitary'],
  },
  {
    id: 'electrical',
    label: 'Electrical',
    icon: '⚡',
    queryValue: 'Electrical',
    shortDesc: 'Wiring, fixtures & appliance repairs',
    tags: ['Electrical', 'Wiring', 'Installation', 'Switchboard', 'Commercial Wiring'],
  },
  {
    id: 'housekeeping-cleaning',
    label: 'Housekeeping / Cleaning',
    icon: '🧹',
    queryValue: 'Housekeeping / Cleaning',
    shortDesc: 'Deep cleaning, sanitization & floor care',
    tags: ['Cleaning', 'Housekeeping', 'Sanitization', 'Sweeping', 'Deep Cleaning'],
  },
  {
    id: 'painting',
    label: 'Painting',
    icon: '🎨',
    queryValue: 'Painting',
    shortDesc: 'Interior/exterior whitewashing & polish',
    tags: ['Painting', 'Interior Painting', 'Exterior Painting', 'Whitewashing', 'Polishing'],
  },
  {
    id: 'agriculture-gardening',
    label: 'Agriculture / Gardening',
    icon: '🌱',
    queryValue: 'Agriculture / Gardening',
    shortDesc: 'Farm harvesting, gardening & pruning',
    tags: ['Gardening', 'Agriculture', 'Farming', 'Harvesting', 'Landscaping', 'Pruning'],
  },
  {
    id: 'helper-unskilled',
    label: 'Helper / Unskilled',
    icon: '🤝',
    queryValue: 'Helper / Unskilled',
    shortDesc: 'Loading, moving & site assistant labor',
    tags: ['Helper', 'Unskilled', 'Loading', 'Warehouse', 'Shifting', 'Labor'],
  },
];

/**
 * SkillCategoryFilter Component
 * 
 * A humanized, touch-friendly trade skill category and tag filtering system
 * tailored for FairConnect informal labor workers.
 * 
 * Features:
 * - Large touch targets (min-h-[48px]) for thumb-friendly mobile & desktop tapping
 * - Clean active state highlighting (bg-blue-600 text-white vs bg-white border-gray-300 text-gray-800)
 * - Horizontal smooth scrolling with visual arrow indicators
 * - Secondary trade-skill tag chips when a category is selected
 * - Accessible ARIA labels and role="tablist" support
 * 
 * @param {Object} props
 * @param {string} [props.selectedCategory='All Jobs'] - Active category label
 * @param {string[]} [props.selectedSkills=[]] - Active skills / tags array
 * @param {function} [props.onFilterChange] - Emits ({ category, skills })
 * @param {function} [props.onCategoryChange] - Emits (category, skills)
 * @param {function} [props.onChange] - Emits ({ category, skills })
 * @param {number} [props.activeJobCount] - Optional total jobs count matching filter
 * @param {string} [props.className] - Optional extra container classes
 */
export default function SkillCategoryFilter({
  selectedCategory = 'All Jobs',
  selectedSkills = [],
  onFilterChange,
  onCategoryChange,
  onChange,
  activeJobCount,
  className = '',
}) {
  const [currentCategory, setCurrentCategory] = useState(selectedCategory);
  const [currentSkills, setCurrentSkills] = useState(selectedSkills);
  const scrollContainerRef = useRef(null);

  // Sync internal state when parent props change
  useEffect(() => {
    if (selectedCategory !== undefined && selectedCategory !== currentCategory) {
      setCurrentCategory(selectedCategory);
    }
  }, [selectedCategory]);

  useEffect(() => {
    if (selectedSkills !== undefined && Array.isArray(selectedSkills)) {
      setCurrentSkills(selectedSkills);
    }
  }, [selectedSkills]);

  // Unified emitter to notify parent feed
  const emitChange = useCallback((newCategory, newSkills) => {
    const isAll = !newCategory || newCategory === 'All Jobs' || newCategory === 'all';
    const normalizedCategory = isAll ? 'All Jobs' : newCategory;
    const categoryQueryParam = isAll ? '' : normalizedCategory;
    const skillsParam = Array.isArray(newSkills) ? newSkills : [];

    const payload = {
      category: normalizedCategory,
      categoryQuery: categoryQueryParam,
      skills: skillsParam,
      skillsQuery: skillsParam.join(','),
      isFiltered: !isAll || skillsParam.length > 0,
    };

    if (typeof onFilterChange === 'function') {
      onFilterChange(payload);
    }
    if (typeof onChange === 'function') {
      onChange(payload);
    }
    if (typeof onCategoryChange === 'function') {
      onCategoryChange(normalizedCategory, skillsParam);
    }
  }, [onFilterChange, onChange, onCategoryChange]);

  // Category tap handler
  const handleSelectCategory = (categoryObj) => {
    const isAll = categoryObj.id === 'all' || categoryObj.label === 'All Jobs';
    const newCategory = isAll ? 'All Jobs' : categoryObj.label;
    
    // Reset specific sub-skill tags when switching categories
    const newSkills = [];
    setCurrentCategory(newCategory);
    setCurrentSkills(newSkills);
    emitChange(newCategory, newSkills);
  };

  // Sub-skill tag toggle handler
  const handleToggleSkillTag = (tag) => {
    let nextSkills;
    if (currentSkills.includes(tag)) {
      nextSkills = currentSkills.filter((s) => s !== tag);
    } else {
      nextSkills = [...currentSkills, tag];
    }
    setCurrentSkills(nextSkills);
    emitChange(currentCategory, nextSkills);
  };

  // Reset all filters back to All Jobs
  const handleClearAll = () => {
    setCurrentCategory('All Jobs');
    setCurrentSkills([]);
    emitChange('All Jobs', []);
  };

  // Horizontal scroll helpers
  const scrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -260, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 260, behavior: 'smooth' });
    }
  };

  // Locate current active category object for sub-tags display
  const activeCategoryObj = TRADE_CATEGORIES.find(
    (c) => c.label.toLowerCase() === currentCategory?.toLowerCase() ||
           (c.id === 'all' && (currentCategory === 'All Jobs' || !currentCategory))
  );

  const isFiltered = currentCategory !== 'All Jobs' || currentSkills.length > 0;

  return (
    <div
      className={`skill-category-filter-root w-full bg-white border border-gray-200 rounded-2xl p-3.5 sm:p-4 shadow-xs ${className}`}
      style={{
        backgroundColor: '#ffffff',
        border: '1px solid #e5e7eb',
        borderRadius: '16px',
        padding: '1rem',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)',
      }}
    >
      {/* ── Filter Header Bar ────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between mb-3 flex-wrap gap-2"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '0.75rem',
          flexWrap: 'wrap',
          gap: '0.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1.15rem' }}>🛠️</span>
          <div>
            <h4
              style={{
                margin: 0,
                fontSize: '0.98rem',
                fontWeight: 700,
                color: '#111827',
                letterSpacing: '-0.01em',
              }}
            >
              Filter Jobs by Trade Skill
            </h4>
            <p style={{ margin: '1px 0 0 0', fontSize: '0.78rem', color: '#6b7280' }}>
              Tap a trade category to discover matching listings in your primary trade
            </p>
          </div>
        </div>

        {/* Status & Reset Action */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          {typeof activeJobCount === 'number' && (
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                color: '#2563eb',
                background: '#eff6ff',
                padding: '0.2rem 0.6rem',
                borderRadius: '9999px',
                border: '1px solid #bfdbfe',
              }}
            >
              {activeJobCount} {activeJobCount === 1 ? 'Job' : 'Jobs'} Found
            </span>
          )}

          {isFiltered && (
            <button
              id="clear-skill-category-filter-btn"
              type="button"
              onClick={handleClearAll}
              style={{
                background: '#f3f4f6',
                border: '1px solid #d1d5db',
                color: '#374151',
                padding: '0.3rem 0.75rem',
                borderRadius: '8px',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                transition: 'all 0.15s ease',
              }}
              title="Reset all filters to All Jobs"
            >
              <span>✕</span> Reset to All Jobs
            </button>
          )}
        </div>
      </div>

      {/* ── Main Category Buttons Carousel / Row ─────────────────────────── */}
      <div style={{ position: 'relative', width: '100%' }}>
        {/* Scroll Left Button (Visible on desktop/larger screens) */}
        <button
          type="button"
          onClick={scrollLeft}
          aria-label="Scroll trade categories left"
          className="hidden md:flex"
          style={{
            position: 'absolute',
            left: '-10px',
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 10,
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: '#ffffff',
            border: '1px solid #d1d5db',
            boxShadow: '0 2px 6px rgba(0, 0, 0, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: '#374151',
            fontSize: '0.9rem',
            fontWeight: 'bold',
          }}
        >
          ‹
        </button>

        {/* Scrollable Container */}
        <div
          ref={scrollContainerRef}
          role="tablist"
          aria-label="Filter jobs by trade skill category"
          style={{
            display: 'flex',
            gap: '0.75rem',
            overflowX: 'auto',
            paddingBottom: '0.4rem',
            paddingTop: '0.15rem',
            scrollBehavior: 'smooth',
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'thin',
          }}
        >
          {TRADE_CATEGORIES.map((cat) => {
            const isSelected =
              (cat.id === 'all' && (currentCategory === 'All Jobs' || !currentCategory)) ||
              cat.label.toLowerCase() === currentCategory?.toLowerCase();

            return (
              <button
                key={cat.id}
                id={`category-btn-${cat.id}`}
                role="tab"
                type="button"
                aria-selected={isSelected}
                onClick={() => handleSelectCategory(cat)}
                style={{
                  minHeight: '48px',
                  padding: '0.65rem 1.15rem',
                  borderRadius: '12px',
                  fontSize: '0.88rem',
                  fontWeight: isSelected ? 600 : 500,
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  userSelect: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  transition: 'all 0.18s cubic-bezier(0.4, 0, 0.2, 1)',
                  flexShrink: 0,
                  /* Exact styling specified in prompt */
                  backgroundColor: isSelected ? '#2563eb' : '#ffffff',
                  color: isSelected ? '#ffffff' : '#1f2937',
                  border: isSelected ? '1px solid #2563eb' : '1px solid #d1d5db',
                  boxShadow: isSelected
                    ? '0 4px 10px rgba(37, 99, 235, 0.25)'
                    : '0 1px 2px rgba(0, 0, 0, 0.05)',
                  outline: 'none',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.borderColor = '#93c5fd';
                    e.currentTarget.style.backgroundColor = '#f8fafc';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.borderColor = '#d1d5db';
                    e.currentTarget.style.backgroundColor = '#ffffff';
                  }
                }}
              >
                <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>{cat.icon}</span>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ lineHeight: 1.2 }}>{cat.label}</div>
                </div>
                {isSelected && (
                  <span
                    style={{
                      display: 'inline-block',
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: '#ffffff',
                      marginLeft: '0.15rem',
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Scroll Right Button */}
        <button
          type="button"
          onClick={scrollRight}
          aria-label="Scroll trade categories right"
          className="hidden md:flex"
          style={{
            position: 'absolute',
            right: '-10px',
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 10,
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: '#ffffff',
            border: '1px solid #d1d5db',
            boxShadow: '0 2px 6px rgba(0, 0, 0, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: '#374151',
            fontSize: '0.9rem',
            fontWeight: 'bold',
          }}
        >
          ›
        </button>
      </div>

      {/* ── Sub-Skill / Tag Filtering Pills (When category is selected) ───── */}
      {activeCategoryObj && activeCategoryObj.tags.length > 0 && (
        <div
          style={{
            marginTop: '0.85rem',
            paddingTop: '0.75rem',
            borderTop: '1px dashed #e5e7eb',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.45rem',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.78rem',
              color: '#4b5563',
            }}
          >
            <span>
              <strong>Specialized Skill Tags</strong> in {activeCategoryObj.label}:
            </span>
            {currentSkills.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setCurrentSkills([]);
                  emitChange(currentCategory, []);
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#2563eb',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.75rem',
                }}
              >
                Clear skill tags ({currentSkills.length})
              </button>
            )}
          </div>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.45rem',
              alignItems: 'center',
            }}
          >
            {/* "All [Trade]" Pill */}
            <button
              type="button"
              id="tag-pill-all-skills"
              onClick={() => {
                setCurrentSkills([]);
                emitChange(currentCategory, []);
              }}
              style={{
                minHeight: '36px',
                padding: '0.35rem 0.85rem',
                borderRadius: '9999px',
                fontSize: '0.8rem',
                fontWeight: currentSkills.length === 0 ? 600 : 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                backgroundColor: currentSkills.length === 0 ? '#1e40af' : '#f3f4f6',
                color: currentSkills.length === 0 ? '#ffffff' : '#374151',
                border: currentSkills.length === 0 ? '1px solid #1e40af' : '1px solid #e5e7eb',
              }}
            >
              All {activeCategoryObj.label.split('/')[0].trim()}
            </button>

            {/* Individual Tags */}
            {activeCategoryObj.tags.map((tag) => {
              const isTagActive = currentSkills.includes(tag);
              return (
                <button
                  key={tag}
                  id={`tag-pill-${tag.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
                  type="button"
                  onClick={() => handleToggleSkillTag(tag)}
                  style={{
                    minHeight: '36px',
                    padding: '0.35rem 0.85rem',
                    borderRadius: '9999px',
                    fontSize: '0.8rem',
                    fontWeight: isTagActive ? 600 : 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    backgroundColor: isTagActive ? '#2563eb' : '#ffffff',
                    color: isTagActive ? '#ffffff' : '#374151',
                    border: isTagActive ? '1px solid #2563eb' : '1px solid #d1d5db',
                    boxShadow: isTagActive ? '0 2px 6px rgba(37, 99, 235, 0.2)' : 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                  }}
                >
                  <span>{isTagActive ? '✓' : '#'}</span>
                  <span>{tag}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
