import React from 'react';
import { X, AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';
import './Modal.css';

export const Modal = ({ isOpen, onClose, children, size = 'medium' }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className={`modal-container modal-${size}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
};

export const ConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirmar ação',
  message = 'Tem certeza que deseja continuar?',
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  type = 'warning', // warning, danger, info, success
  loading = false
}) => {
  const icons = {
    warning: AlertTriangle,
    danger: AlertCircle,
    info: Info,
    success: CheckCircle
  };

  const Icon = icons[type];

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="small">
      <div className="modal-content">
        <div className={`modal-icon-container modal-icon-${type}`}>
          <Icon size={40} />
        </div>

        <h2 className="modal-title">{title}</h2>
        <p className="modal-message">{message}</p>

        <div className="modal-actions">
          <button
            className="modal-btn modal-btn-secondary"
            onClick={onClose}
            disabled={loading}
          >
            {cancelText}
          </button>
          <button
            className={`modal-btn modal-btn-${type}`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? (
              <>
                <div className="modal-spinner"></div>
                Processando...
              </>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export const PromptModal = ({
  isOpen,
  onClose,
  onSubmit,
  title = 'Informe os dados',
  message,
  placeholder = '',
  inputType = 'text',
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  loading = false
}) => {
  const [value, setValue] = React.useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (value.trim()) {
      onSubmit(value);
    }
  };

  const handleClose = () => {
    setValue('');
    onClose();
  };

  React.useEffect(() => {
    if (!isOpen) {
      setValue('');
    }
  }, [isOpen]);

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="small">
      <div className="modal-content">
        <button className="modal-close-btn" onClick={handleClose}>
          <X size={20} />
        </button>

        <h2 className="modal-title">{title}</h2>
        {message && <p className="modal-message">{message}</p>}

        <form onSubmit={handleSubmit}>
          <input
            type={inputType}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            className="modal-input"
            autoFocus
            disabled={loading}
          />

          <div className="modal-actions">
            <button
              type="button"
              className="modal-btn modal-btn-secondary"
              onClick={handleClose}
              disabled={loading}
            >
              {cancelText}
            </button>
            <button
              type="submit"
              className="modal-btn modal-btn-primary"
              disabled={loading || !value.trim()}
            >
              {loading ? (
                <>
                  <div className="modal-spinner"></div>
                  Processando...
                </>
              ) : (
                confirmText
              )}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
};

export const SelectModal = ({
  isOpen,
  onClose,
  onSelect,
  title = 'Selecione uma opção',
  message,
  options = [],
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  loading = false
}) => {
  const [selectedValue, setSelectedValue] = React.useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (selectedValue) {
      onSelect(selectedValue);
    }
  };

  const handleClose = () => {
    setSelectedValue('');
    onClose();
  };

  React.useEffect(() => {
    if (!isOpen) {
      setSelectedValue('');
    }
  }, [isOpen]);

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="small">
      <div className="modal-content">
        <button className="modal-close-btn" onClick={handleClose}>
          <X size={20} />
        </button>

        <h2 className="modal-title">{title}</h2>
        {message && <p className="modal-message">{message}</p>}

        <form onSubmit={handleSubmit}>
          <div className="modal-options">
            {options.map((option, index) => (
              <label key={index} className="modal-option">
                <input
                  type="radio"
                  name="option"
                  value={option.value}
                  checked={selectedValue === option.value}
                  onChange={(e) => setSelectedValue(e.target.value)}
                  disabled={loading}
                />
                <span className="modal-option-label">{option.label}</span>
              </label>
            ))}
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="modal-btn modal-btn-secondary"
              onClick={handleClose}
              disabled={loading}
            >
              {cancelText}
            </button>
            <button
              type="submit"
              className="modal-btn modal-btn-primary"
              disabled={loading || !selectedValue}
            >
              {loading ? (
                <>
                  <div className="modal-spinner"></div>
                  Processando...
                </>
              ) : (
                confirmText
              )}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
};
