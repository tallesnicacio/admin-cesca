import React from 'react';
import { AlertCircle } from 'lucide-react';
import './Input.css';

export const Input = ({
  label,
  error,
  icon: Icon,
  required = false,
  ...props
}) => {
  return (
    <div className="input-group">
      {label && (
        <label className="input-label">
          {Icon && <Icon size={16} className="label-icon" />}
          {label}
          {required && <span className="required-mark">*</span>}
        </label>
      )}
      <input
        className={`input-field ${error ? 'input-error' : ''}`}
        {...props}
      />
      {error && (
        <div className="error-message">
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};

export const PhoneInput = ({
  label,
  value,
  onChange,
  error,
  icon: Icon,
  required = false,
  ...props
}) => {
  const handleChange = (e) => {
    let input = e.target.value.replace(/\D/g, '');
    if (input.length > 11) input = input.slice(0, 11);

    let formatted = '';
    if (input.length > 0) {
      formatted = '(' + input.slice(0, 2);
      if (input.length >= 3) {
        formatted += ') ' + input.slice(2, 7);
      }
      if (input.length >= 8) {
        formatted += '-' + input.slice(7, 11);
      }
    }

    e.target.value = formatted;
    onChange(e);
  };

  return (
    <div className="input-group">
      {label && (
        <label className="input-label">
          {Icon && <Icon size={16} className="label-icon" />}
          {label}
          {required && <span className="required-mark">*</span>}
        </label>
      )}
      <input
        type="tel"
        value={value}
        onChange={handleChange}
        placeholder="(00) 00000-0000"
        maxLength={15}
        className={`input-field ${error ? 'input-error' : ''}`}
        {...props}
      />
      {error && (
        <div className="error-message">
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};

export const Select = ({
  label,
  options = [],
  error,
  icon: Icon,
  placeholder = "Selecione uma opção",
  required = false,
  ...props
}) => {
  return (
    <div className="input-group">
      {label && (
        <label className="input-label">
          {Icon && <Icon size={16} className="label-icon" />}
          {label}
          {required && <span className="required-mark">*</span>}
        </label>
      )}
      <div className="select-wrapper">
        <select
          className={`select-field ${error ? 'input-error' : ''}`}
          {...props}
        >
          <option value="">{placeholder}</option>
          {options.map((option, index) => (
            <option key={index} value={option.value || option}>
              {option.label || option}
            </option>
          ))}
        </select>
        <div className="select-arrow">
          <svg width="12" height="8" viewBox="0 0 12 8" fill="none">
            <path d="M1 1.5L6 6.5L11 1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>
      </div>
      {error && (
        <div className="error-message">
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};

export const Textarea = ({
  label,
  error,
  icon: Icon,
  required = false,
  ...props
}) => {
  return (
    <div className="input-group">
      {label && (
        <label className="input-label">
          {Icon && <Icon size={16} className="label-icon" />}
          {label}
          {required && <span className="required-mark">*</span>}
        </label>
      )}
      <textarea
        className={`textarea-field ${error ? 'input-error' : ''}`}
        {...props}
      />
      {error && (
        <div className="error-message">
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};

export const RadioGroup = ({
  label,
  options = [],
  name,
  value,
  onChange,
  error,
  icon: Icon,
  required = false
}) => {
  return (
    <div className="input-group">
      {label && (
        <label className="input-label">
          {Icon && <Icon size={16} className="label-icon" />}
          {label}
          {required && <span className="required-mark">*</span>}
        </label>
      )}
      <div className="radio-group">
        {options.map((option, index) => (
          <label key={index} className="radio-option">
            <input
              type="radio"
              name={name}
              value={option.value || option}
              checked={value === (option.value || option)}
              onChange={onChange}
            />
            <span className="radio-custom"></span>
            <span className="radio-label">{option.label || option}</span>
          </label>
        ))}
      </div>
      {error && (
        <div className="error-message">
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};

export const Checkbox = ({
  label,
  checked,
  onChange,
  error,
  required = false,
  ...props
}) => {
  return (
    <div className="checkbox-group">
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
          className="checkbox-input"
          {...props}
        />
        <span className="checkbox-custom"></span>
        <span className="checkbox-text">
          {label}
          {required && <span className="required-mark">*</span>}
        </span>
      </label>
      {error && (
        <div className="error-message">
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};
