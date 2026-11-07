import React, { useState } from 'react';
import closeIcon from '../assets/close-icon.svg';

import '../styles/OriginalTrackManager.css';


export default function OriginalTrackManager({
  availableTracks = [],
  selectedTrackId,
  onChange,
  disabled = false,
}) {
  // Состояния поискового запроса и выпадающего списка
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Выбранный оригинальный трек
  const selectedTrack = availableTracks.find(
    (t) => String(t.id) === String(selectedTrackId),
  );

  // Фильтрация треков по запросу с исключением каверов
  const filteredSuggestions = availableTracks.filter((track) => {
    if (String(track.id) === String(selectedTrackId)) return false;
    if (track.is_cover || track.original_track_id) return false;

    const query = searchQuery.toLowerCase().trim();
    const titleMatch = (track.title || '').toLowerCase().includes(query);
    const artistMatch = (track.artist?.name || '')
      .toLowerCase()
      .includes(query);
    return titleMatch || artistMatch;
  });

  // Выбор оригинального трека
  const handleSelect = (trackId) => {
    onChange(trackId);
    setSearchQuery('');
    setIsDropdownOpen(false);
  };

  // Сброс выбранного трека
  const handleClear = () => {
    onChange(null);
  };

  return (
    <div className="original-track-manager">
      <p className="original-track-hint">
        <em>
          Укажите оригинальный трек из каталога. Выбирать другие кавер-версии
          нельзя.
        </em>
      </p>

      {/* Поиск оригинального трека */}
      {!selectedTrack && !disabled && (
        <div className="original-track-manager-collab-search-container">
          <input
            type="text"
            className="original-track-manager-input-element original-track-manager-collab-search-input"
            placeholder="Поиск оригинального трека по названию или артисту..."
            value={searchQuery}
            onFocus={() => setIsDropdownOpen(true)}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsDropdownOpen(true);
            }}
          />

          {isDropdownOpen && searchQuery.trim() && (
            <div className="original-track-manager-collab-dropdown-menu">
              {filteredSuggestions.length === 0 ? (
                <div className="original-track-manager-collab-dropdown-item original-track-manager-collab-dropdown-empty">
                  Оригинальные треки не найдены (каверы исключены)
                </div>
              ) : (
                filteredSuggestions.slice(0, 10).map((t) => (
                  <div
                    key={t.id}
                    className="original-track-manager-entity-dropdown-item"
                    onClick={() => handleSelect(t.id)}
                  >
                    <span className="entity-name-bold">{t.title}</span>
                    <span className="original-track-manager-entity-genre-text">
                      {t.artist?.name || 'Исполнитель'}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* Отображение выбранного оригинального трека */}
      {selectedTrack && (
        <div className="original-track-manager-entity-card-row is-cover">
          <div className="original-track-manager-entity-card-left">
            <span className="original-track-manager-entity-badge cover-badge">Оригинал</span>
            <span className="original-track-manager-entity-name-text">{selectedTrack.title}</span>
            <span className="original-track-manager-entity-genre-text">
              — {selectedTrack.artist?.name || 'Неизвестный'}
            </span>
          </div>

          {!disabled && (
            <div className="original-track-manager-entity-card-actions">
              <button
                type="button"
                className="original-track-manager-entity-icon-btn original-track-manager-remove-btn"
                onClick={handleClear}
                title="Отвязать оригинал"
              >
                <img src={closeIcon} alt="Удалить" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
