import React, { useState } from 'react';
import Button from './Button';
import closeIcon from '../assets/close-icon.svg';
import alertIcon from '../assets/alert-circle.svg';

import '../styles/RejectReasonModal.css';

// Типовые шаблоны причин отклонения
const REJECTION_PRESETS = [
  'Низкое качество аудиофайла (присутствуют шумы, низкий битрейт)'
];

export default function RejectReasonModal({
  isOpen,
  onClose,
  onConfirm,
  itemTitle,
  loading = false,
}) {
  const [reason, setReason] = useState('');

  if (!isOpen) return null;

  // Отправка решения об отклонении
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!reason.trim()) return;
    onConfirm(reason.trim());
    setReason('');
  };

  // Выбор готового шаблона причины
  const handleSelectPreset = (preset) => {
    setReason(preset);
  };

  return (
    <div
      className="reject-reason-modal-modal-background"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="reject-reason-modal-modal-window reject-reason-modal-window">
        <div className="reject-reason-modal-modal-window-top-buttons">
          <button type="button" className="reject-reason-modal-modal-window-top-button reject-reason-modal-active">
            Отклонение заявки
          </button>
          <button
            type="button"
            className="reject-reason-modal-modal-close-button"
            onClick={onClose}
            title="Закрыть"
          >
            <img src={closeIcon} alt="✕" />
          </button>
        </div>

        <div className="reject-reason-modal-modal-window-content">
          <form className="reject-reason-modal-auth-form" onSubmit={handleSubmit}>
            <div className="reject-reason-alert-row">
              <img src={alertIcon} alt="Внимание" className="reject-reason-alert-icon" />
              <span className="reject-reason-alert-title">
                Укажите причину для автора
              </span>
            </div>

            <p className="reject-reason-modal-auth-form-subtitle reject-reason-subtitle">
              Причина отклонения для <strong>«{itemTitle || 'материала'}»</strong> будет отправлена автору в уведомлении:
            </p>

            {/* Быстрые шаблоны причин */}
            <div>
              <label className="reject-reason-presets-label">
                Быстрые шаблоны:
              </label>
              <div className="reject-reason-modal-reject-presets">
                {REJECTION_PRESETS.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className={`reject-reason-modal-reject-preset-chip ${reason === preset ? 'reject-reason-modal-active' : ''}`}
                    onClick={() => handleSelectPreset(preset)}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            <div className="reject-reason-modal-auth-form-group">
              <label>Подробная причина отклонения *</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Опишите, что именно необходимо исправить (качество звука, обложка, теги)..."
                required
                disabled={loading}
                className="reject-reason-modal-moderation-textarea reject-reason-textarea"
                autoFocus
              />
            </div>

            <div className="reject-reason-modal-modal-actions-row">
              <Button
                type="button"
                variant="secondary"
                onClick={onClose}
                disabled={loading}
              >
                Отмена
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={loading || !reason.trim()}
              >
                {loading ? 'Отклонение...' : 'Отклонить с причиной'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
