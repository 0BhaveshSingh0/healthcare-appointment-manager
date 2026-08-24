import React from 'react';

export default function Card({ children, style = {}, className = '', noPadding = false, ...props }) {
  const baseStyles = {
    background: 'var(--bg-card)',
    borderRadius: 'var(--border-radius)',
    boxShadow: 'var(--shadow-sm)',
    border: '1px solid var(--border-color)',
    padding: noPadding ? '0' : '24px',
    ...style
  };

  return (
    <div style={baseStyles} className={className} {...props}>
      {children}
    </div>
  );
}
