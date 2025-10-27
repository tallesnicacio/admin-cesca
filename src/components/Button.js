import React from 'react';
import './Button.css';

export const Button = ({
  children,
  variant = 'primary',
  size = 'medium',
  loading = false,
  disabled = false,
  icon: Icon,
  iconPosition = 'left',
  fullWidth = false,
  ...props
}) => {
  const classNames = [
    'btn',
    `btn-${variant}`,
    `btn-${size}`,
    fullWidth ? 'btn-full-width' : '',
    loading ? 'btn-loading' : '',
    disabled ? 'btn-disabled' : ''
  ].filter(Boolean).join(' ');

  return (
    <button
      className={classNames}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <span className="btn-spinner">
          <svg className="spinner" viewBox="0 0 50 50">
            <circle
              className="spinner-path"
              cx="25"
              cy="25"
              r="20"
              fill="none"
              strokeWidth="5"
            />
          </svg>
        </span>
      )}
      {!loading && Icon && iconPosition === 'left' && (
        <Icon size={size === 'small' ? 16 : size === 'large' ? 24 : 20} />
      )}
      <span className="btn-text">{children}</span>
      {!loading && Icon && iconPosition === 'right' && (
        <Icon size={size === 'small' ? 16 : size === 'large' ? 24 : 20} />
      )}
    </button>
  );
};

export const LoadingSpinner = ({ size = 40, color = '#667eea' }) => {
  return (
    <div className="loading-spinner" style={{ width: size, height: size }}>
      <svg className="spinner" viewBox="0 0 50 50">
        <circle
          className="spinner-path"
          cx="25"
          cy="25"
          r="20"
          fill="none"
          strokeWidth="5"
          style={{ stroke: color }}
        />
      </svg>
    </div>
  );
};

export const LoadingOverlay = ({ message = 'Carregando...' }) => {
  return (
    <div className="loading-overlay">
      <div className="loading-content">
        <LoadingSpinner size={60} />
        <p className="loading-message">{message}</p>
      </div>
    </div>
  );
};
