import React from 'react';

export default function Badge({ children, status, style = {}, ...props }) {
  const getStatusStyles = () => {
    switch (status?.toUpperCase()) {
      case 'SCHEDULED':
      case 'CONNECTED':
        return {
          background: 'var(--info-bg)',
          color: 'var(--info-text)',
        };
      case 'CANCELLED':
      case 'NOT CONNECTED':
      case 'FAILED':
      case 'HIGH':
        return {
          background: 'var(--danger-bg)',
          color: 'var(--danger-text)',
        };
      case 'COMPLETED':
      case 'SUCCESS':
        return {
          background: 'var(--success-bg)',
          color: 'var(--success-text)',
        };
      case 'PENDING':
      case 'MEDIUM':
        return {
          background: 'var(--warning-bg)',
          color: 'var(--warning-text)',
        };
      default:
        return {
          background: '#F1F5F9', // slate-100
          color: '#475569', // slate-600
        };
    }
  };

  const baseStyles = {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '4px 10px',
    borderRadius: '9999px',
    fontSize: '0.75rem',
    fontWeight: '600',
    whiteSpace: 'nowrap',
    ...getStatusStyles(),
    ...style
  };

  return (
    <span style={baseStyles} {...props}>
      {children || status}
    </span>
  );
}
