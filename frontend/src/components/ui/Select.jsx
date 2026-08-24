import React, { forwardRef } from 'react';

const Select = forwardRef(({ label, error, helperText, options = [], style = {}, className = '', ...props }, ref) => {
  const containerStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    width: '100%',
    marginBottom: '16px'
  };

  const labelStyle = {
    fontSize: '0.875rem',
    fontWeight: '500',
    color: 'var(--text-primary)'
  };

  const selectStyle = {
    width: '100%',
    padding: '10px 12px',
    fontSize: '1rem',
    borderRadius: 'var(--border-radius-sm)',
    border: `1px solid ${error ? 'var(--danger)' : 'var(--border-color)'}`,
    background: props.disabled ? 'var(--bg-page)' : 'var(--bg-card)',
    color: 'var(--text-primary)',
    boxSizing: 'border-box',
    outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    ...style
  };

  return (
    <div style={containerStyle} className={className}>
      {label && <label style={labelStyle}>{label}</label>}
      <select 
        ref={ref}
        style={selectStyle}
        onFocus={(e) => {
          e.target.style.borderColor = error ? 'var(--danger)' : 'var(--primary)';
          e.target.style.boxShadow = `0 0 0 1px ${error ? 'var(--danger)' : 'var(--primary)'}`;
        }}
        onBlur={(e) => {
          e.target.style.borderColor = error ? 'var(--danger)' : 'var(--border-color)';
          e.target.style.boxShadow = 'none';
        }}
        {...props} 
      >
        {options.map((opt, idx) => (
          <option key={idx} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {(error || helperText) && (
        <span style={{ fontSize: '0.75rem', color: error ? 'var(--danger)' : 'var(--text-secondary)' }}>
          {error || helperText}
        </span>
      )}
    </div>
  );
});

export default Select;
