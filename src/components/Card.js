import React from 'react';
import './Card.css';

export const Card = ({ children, className = '', ...props }) => {
  return (
    <div className={`card ${className}`} {...props}>
      {children}
    </div>
  );
};

export const CardHeader = ({ children, className = '' }) => {
  return (
    <div className={`card-header ${className}`}>
      {children}
    </div>
  );
};

export const CardBody = ({ children, className = '' }) => {
  return (
    <div className={`card-body ${className}`}>
      {children}
    </div>
  );
};

export const CardFooter = ({ children, className = '' }) => {
  return (
    <div className={`card-footer ${className}`}>
      {children}
    </div>
  );
};

export const ProgressBar = ({ current, total, showLabel = true }) => {
  const percentage = (current / total) * 100;

  return (
    <div className="progress-container">
      {showLabel && (
        <div className="progress-label">
          <span>Passo {current} de {total}</span>
          <span className="progress-percentage">{Math.round(percentage)}%</span>
        </div>
      )}
      <div className="progress-bar">
        <div
          className="progress-fill"
          style={{ width: `${percentage}%` }}
        >
          <div className="progress-shine"></div>
        </div>
      </div>
    </div>
  );
};

export const Alert = ({
  type = 'info',
  title,
  message,
  icon: Icon,
  onClose
}) => {
  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ'
  };

  return (
    <div className={`alert alert-${type}`}>
      <div className="alert-icon">
        {Icon ? <Icon size={24} /> : icons[type]}
      </div>
      <div className="alert-content">
        {title && <div className="alert-title">{title}</div>}
        {message && <div className="alert-message">{message}</div>}
      </div>
      {onClose && (
        <button className="alert-close" onClick={onClose}>
          ✕
        </button>
      )}
    </div>
  );
};
