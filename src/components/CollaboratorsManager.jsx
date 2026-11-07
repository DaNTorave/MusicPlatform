import React, { useState } from 'react';
import close_icon from '../assets/close-icon.svg';
import '../styles/CollaboratorsManager.css';


export default function CollaboratorsManager({
  mainArtist,
  availableArtists = [],
  collaboratorIds = [],
  onChange,
  disabled = false,
}) {
  // Состояние поискового запроса и открытия выпадающего списка
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Фильтрация артистов по запросу с исключением основного и уже выбранных
  const filteredSuggestions = availableArtists.filter((artist) => {
    const isMain = String(artist.id) === String(mainArtist?.id);
    const isAlreadySelected = collaboratorIds.includes(artist.id);
    const matchesQuery = artist.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase().trim());
    return !isMain && !isAlreadySelected && matchesQuery;
  });

  // Добавление соавтора в список
  const handleAddCollaborator = (artistId) => {
    onChange([...collaboratorIds, artistId]);
    setSearchQuery('');
    setIsDropdownOpen(false);
  };

  // Удаление соавтора из списка
  const handleRemoveCollaborator = (artistId) => {
    onChange(collaboratorIds.filter((id) => id !== artistId));
  };

  // Перемещение соавтора вверх или вниз по списку
  const handleMove = (index, direction) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= collaboratorIds.length) return;
    const updated = [...collaboratorIds];
    const [movedItem] = updated.splice(index, 1);
    updated.splice(newIndex, 0, movedItem);
    onChange(updated);
  };

  return (
    <div className="collaborators-manager-meta-box-card">
      <div className="collaborators-manager-meta-box-header">
        <span className="collaborators-manager-meta-box-title">Авторы и соавторы</span>
      </div>

      {/* Поиск артистов для добавления в соавторы */}
      {!disabled && (
        <div className="collaborators-manager-collab-search-container">
          <input
            type="text"
            className="collaborators-manager-input-element collaborators-manager-collab-search-input"
            placeholder="Поиск артиста для добавления в соавторы..."
            value={searchQuery}
            onFocus={() => setIsDropdownOpen(true)}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsDropdownOpen(true);
            }}
          />

          {isDropdownOpen && searchQuery.trim() && (
            <div className="collaborators-manager-collab-dropdown-menu">
              {filteredSuggestions.length === 0 ? (
                <div className="collaborators-manager-collab-dropdown-item collaborators-manager-collab-dropdown-empty">
                  Артист не найден
                </div>
              ) : (
                filteredSuggestions.map((artist) => (
                  <div
                    key={artist.id}
                    className="collaborators-manager-entity-dropdown-item"
                    onClick={() => handleAddCollaborator(artist.id)}
                  >
                    <span>+ {artist.name}</span>
                    {artist.genre && (
                      <span className="collaborators-manager-entity-genre-text">{artist.genre}</span>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      <div className="collab-list">
        {/* Основной артист всегда первый в списке */}
        {mainArtist && (
          <div className="collaborators-manager-entity-card-row is-main">
            <div className="collaborators-manager-entity-card-left">
              <span className="entity-order-index">#1</span>
              <span className="collaborators-manager-entity-name-text">{mainArtist.name}</span>
            </div>
            <span className="collaborators-manager-entity-badge main-badge">Основной</span>
          </div>
        )}

        {/* Список выбранных соавторов с возможностью перемещения и удаления */}
        {collaboratorIds.map((cId, idx) => {
          const artist = availableArtists.find(
            (a) => String(a.id) === String(cId),
          );
          if (!artist) return null;

          return (
            <div key={artist.id} className="collaborators-manager-entity-card-row">
              <div className="collaborators-manager-entity-card-left">
                <span className="entity-order-index">#{idx + 2}</span>
                <span className="collaborators-manager-entity-name-text">{artist.name}</span>
                {artist.genre && (
                  <span className="collaborators-manager-entity-genre-text">({artist.genre})</span>
                )}
              </div>

              {!disabled && (
                <div className="collaborators-manager-entity-card-actions">
                  <button
                    type="button"
                    className="collaborators-manager-entity-icon-btn"
                    disabled={idx === 0}
                    onClick={() => handleMove(idx, -1)}
                    title="Выше"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    className="collaborators-manager-entity-icon-btn"
                    disabled={idx === collaboratorIds.length - 1}
                    onClick={() => handleMove(idx, 1)}
                    title="Ниже"
                  >
                    ▼
                  </button>
                  <button
                    type="button"
                    className="collaborators-manager-entity-icon-btn collaborators-manager-remove-btn"
                    onClick={() => handleRemoveCollaborator(artist.id)}
                    title="Удалить"
                  >
                    <img src={close_icon} alt="Удалить" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
