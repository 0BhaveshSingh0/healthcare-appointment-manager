import React from 'react';
import Spinner from './Spinner';

export default function Button({ 
  children, 
  variant = 'primary', // primary, secondary, danger, ghost
  isLoading = false,
  disabled = false,
  onClick,
  type = 'button',
  style = {},
  className = '',
  fullWidth = false,
  ...props 
}) {
  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return {
          background: 'var(--primary)',
          color: 'var(--text-inverse)',
          border: '1px solid var(--primary)',
        };
      case 'secondary':
        return {
          background: 'var(--bg-card)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border-color)',
        };
      case 'danger':
        return {
          background: 'var(--danger)',
          color: 'var(--text-inverse)',
          border: '1px solid var(--danger)',
        };
      case 'ghost':
        return {
          background: 'transparent',
          color: 'var(--text-secondary)',
          border: '1px solid transparent',
        };
      default:
        return {};
    }
  };

  const baseStyles = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '8px 16px',
    fontSize: '0.875rem',
    fontWeight: '500',
    borderRadius: 'var(--border-radius)',
    cursor: disabled || isLoading ? 'not-allowed' : 'pointer',
    opacity: disabled || isLoading ? 0.6 : 1,
    transition: 'background-color 0.2s, opacity 0.2s',
    width: fullWidth ? '100%' : 'auto',
    ...getVariantStyles(),
    ...style
  };

  return (
    <button 
      type={type} 
      onClick={onClick} 
      disabled={disabled || isLoading} 
      style={baseStyles} 
      className={className}
      {...props}
    >
      {isLoading && <Spinner size="16px" color={variant === 'secondary' || variant === 'ghost' ? 'var(--text-primary)' : 'var(--text-inverse)'} />}
      {children}
    </button>
  );
}
