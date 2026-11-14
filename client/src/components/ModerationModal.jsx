import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAudioPlayer } from '../context/AudioContext';
import { apiClient } from '../api/apiClient';

import Button from './Button';
import TrackSlotItem from './TrackSlotItem';
import CollaboratorsManager from './CollaboratorsManager';
import OriginalTrackManager from './OriginalTrackManager';
import AgeRestrictionToggle from './AgeRestrictionToggle';
import ImageCropModal from './ImageCropModal';

import playIcon from '../assets/play-icon.svg';
import pauseIcon from '../assets/pause-icon.svg';
import closeIcon from '../assets/close-icon.svg';
import alertIcon from '../assets/alert-circle.svg';

import '../styles/ModerationModal.css';


const COMMON_REJECT_REASONS = [
  'Низкое качество аудиофайла (присутствуют шумы, низкий битрейт)',
];

export default function ModerationModal({
  isOpen,
  onClose,
  item,
  onApprove,
  onReject,
  loading,
}) {
  const [title, setTitle] = useState('');
  const [releaseYear, setReleaseYear] = useState('');
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState('');
  const [audioFile, setAudioFile] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [tracks, setTracks] = useState([]);
  const [availableArtists, setAvailableArtists] = useState([]);
  const [availableTracks, setAvailableTracks] = useState([]);
  const [collaborators, setCollaborators] = useState([]);

  // Управление жанрами при модерации артиста
  const [availableGenres, setAvailableGenres] = useState([]);
  const [selectedGenres, setSelectedGenres] = useState([]);
  const [genreSearch, setGenreSearch] = useState('');

  const [moderationMode, setModerationMode] = useState('review');

  const [isCover, setIsCover] = useState(false);
  const [originalTrackId, setOriginalTrackId] = useState(null);
  const [isAgeRestricted, setIsAgeRestricted] = useState(false);

  // Кадрирование обложки при модерации
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [rawImageSrc, setRawImageSrc] = useState('');
  const coverInputRef = useRef(null);

  const {
    playTrack,
    currentTrack,
    isPlaying,
    updateTrackTitle,
    updateTrackCover,
    stopPlayer,
  } = useAudioPlayer();

  useEffect(() => {
    if (isOpen) {
      setModerationMode('review');
      setGenreSearch('');
      apiClient.request('/api/artists').then((res) => {
        if (res?.data) setAvailableArtists(res.data);
      }).catch(() => {});
      apiClient.request('/api/charts/tracks').then((res) => {
        if (res?.data) setAvailableTracks(res.data);
      }).catch(() => {});
      apiClient.getGenres().then((res) => {
        if (res?.data) setAvailableGenres(res.data);
      }).catch(() => {});
    }
  }, [isOpen]);

  useEffect(() => {
    if (item) {
      setTitle(item.title || item.name || '');
      setReleaseYear(item.release_year ? String(item.release_year) : '');
      setCoverPreview(item.cover || item.avatar || '');
      setRejectReason('');
      setCoverFile(null);
      setAudioFile(null);
      setModerationMode('review');
      setGenreSearch('');

      if (item.type === 'artist') {
        const rawList = Array.isArray(item.genres) && item.genres.length > 0
          ? item.genres
          : (item.genre ? item.genre.split(',').map((s) => s.trim()) : []);
        setSelectedGenres(rawList);
      } else {
        setSelectedGenres([]);
      }

      setTracks(
        (item.tracks || []).map((t, idx) => ({
          ...t,
          position: t.position || idx + 1,
          release_year: t.release_year ? String(t.release_year) : '',
          audioFile: null,
          is_cover: Boolean(t.is_cover || t.original_track_id),
          original_track_id: t.original_track_id || null,
          age_restriction: Boolean(
            t.age_restriction || t.has_age_restriction,
          ),
        })),
      );

      setIsCover(Boolean(item.is_cover || item.original_track_id));
      setOriginalTrackId(item.original_track_id || null);
      setIsAgeRestricted(
        Boolean(item.age_restriction || item.has_age_restriction),
      );

      const existingCollabs = (item.collaborators || []).map((c) => c.id);
      setCollaborators(existingCollabs);
    }
  }, [item]);

  const filteredGenres = useMemo(() => {
    const q = genreSearch.trim().toLowerCase();
    if (!q) return availableGenres;
    return availableGenres.filter(
      (g) =>
        (g.title_ru && g.title_ru.toLowerCase().includes(q)) ||
        (g.key && g.key.toLowerCase().includes(q))
    );
  }, [availableGenres, genreSearch]);

  if (!isOpen || !item) return null;

  const handleToggleGenre = (genreKey) => {
    setSelectedGenres((prev) =>
      prev.includes(genreKey)
        ? prev.filter((k) => k !== genreKey)
        : [...prev, genreKey]
    );
  };

  // Выбор файла обложки на модерации с открытием окна кадрирования
  const handleCoverSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setRawImageSrc(URL.createObjectURL(file));
      setCropModalOpen(true);
    }
    e.target.value = '';
  };

  // Завершение кадрирования в модерации
  const handleCropComplete = (croppedFile, previewUrl) => {
    setCoverFile(croppedFile);
    setCoverPreview(previewUrl);

    if (
      currentTrack &&
      (currentTrack.id === item.id ||
        tracks.some((t) => t.id === currentTrack.id))
    ) {
      updateTrackCover(previewUrl);
    }
  };

  const handleSingleTitleChange = (e) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
    if (currentTrack?.id === item.id) updateTrackTitle(newTitle);
  };

  const handleTrackChange = (index, field, value) => {
    const track = tracks[index];
    setTracks((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });

    if (field === 'title' && currentTrack?.id === track.id) {
      updateTrackTitle(value);
    }
  };

  const moveTrack = (fromIndex, toIndex) => {
    if (toIndex < 0 || toIndex >= tracks.length) return;
    setTracks((prev) => {
      const updated = [...prev];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      return updated.map((t, idx) => ({ ...t, position: idx + 1 }));
    });
  };

  const handleRemoveTrack = (index) => {
    setTracks((prev) => prev.filter((_, i) => i !== index));
  };

  const handlePlaySingle = () => {
    playTrack({
      id: item.id,
      title: title || item.title,
      cover: coverPreview,
      streamUrl: audioFile ? URL.createObjectURL(audioFile) : null,
      artist: { name: item.artist_info?.name || 'Модерация' },
      is_cover: isCover,
      original_track: availableTracks.find(
        (t) => String(t.id) === String(originalTrackId),
      ),
    });
  };

  const handlePlayAlbumTrack = (track) => {
    playTrack({
      id: track.id,
      title: track.title,
      cover: coverPreview,
      streamUrl: track.audioFile ? URL.createObjectURL(track.audioFile) : null,
      artist: { name: item.artist_info?.name || 'Модерация' },
      is_cover: track.is_cover,
      original_track: availableTracks.find(
        (t) => String(t.id) === String(track.original_track_id),
      ),
    });
  };

  const handleSubmit = (action, customReason = null) => {
    stopPlayer();
    const schemaType =
      item.type ||
      (item.tracks
        ? 'album'
        : item.genre && !item.audio_uuid
          ? 'artist'
          : 'track');

    const formData = new FormData();
    formData.append('schema', schemaType);
    formData.append('id', item.id);
    formData.append('title', title);
    if (releaseYear) formData.append('release_year', releaseYear);

    if (coverFile) formData.append('cover', coverFile);
    if (audioFile) formData.append('audio', audioFile);

    if (schemaType === 'artist') {
      formData.append('genre', selectedGenres.join(', '));
      selectedGenres.forEach((g) => formData.append('genres[]', g));
    }

    if (schemaType === 'track') {
      formData.append('is_cover', isCover ? 'true' : 'false');
      formData.append('position', '1');
      formData.append(
        'age_restriction',
        isAgeRestricted ? 'true' : 'false',
      );
      if (isCover && originalTrackId) {
        formData.append('original_track_id', String(originalTrackId));
      }
    }

    collaborators.forEach((id) => formData.append('collaborator_ids[]', String(id)));

    if (item.type === 'album') {
      tracks.forEach((track, idx) => {
        if (track.id) formData.append(`tracks[${idx}][id]`, String(track.id));
        formData.append(`tracks[${idx}][title]`, track.title);
        formData.append(`tracks[${idx}][position]`, String(track.position || idx + 1));
        formData.append(
          `tracks[${idx}][release_year]`,
          String(track.release_year || releaseYear || ''),
        );
        formData.append(
          `tracks[${idx}][is_cover]`,
          track.is_cover ? 'true' : 'false',
        );
        formData.append(
          `tracks[${idx}][age_restriction]`,
          track.age_restriction ? 'true' : 'false',
        );
        if (track.is_cover && track.original_track_id) {
          formData.append(
            `tracks[${idx}][original_track_id]`,
            String(track.original_track_id),
          );
        }
        if (track.audioFile)
          formData.append(`tracks[${idx}][audio]`, track.audioFile);
      });
    }

    if (action === 'reject') {
      const finalReason = customReason || rejectReason || 'Отклонено модератором';
      formData.append('status', 'rejected');
      formData.append('comment', finalReason);
      onReject(schemaType, item.id, finalReason);
    } else {
      formData.append('status', 'approved');
      formData.append('comment', 'Одобрено модератором');
      onApprove(formData);
    }
  };

  const isSingleAudio = item.type === 'track' || item.type === 'single';
  const isAlbum = item.type === 'album';
  const isArtist = item.type === 'artist';
  const isSinglePlaying = currentTrack?.id === item.id && isPlaying;

  const isApproveDisabled = (() => {
    if (loading) return true;
    if (!title.trim()) return true;

    if (isArtist) {
      if (selectedGenres.length === 0) return true;
    }

    if (isSingleAudio) {
      if (isCover && !originalTrackId) return true;
    }

    if (isAlbum) {
      if (tracks.length === 0) return true;
      const hasEmptyTitle = tracks.some((t) => !t.title.trim());
      if (hasEmptyTitle) return true;
      const hasIncompleteCover = tracks.some(
        (t) => t.is_cover && !t.original_track_id,
      );
      if (hasIncompleteCover) return true;
    }

    return false;
  })();

  return (
    <>
      <ImageCropModal
        isOpen={cropModalOpen}
        imageSrc={rawImageSrc}
        cropShape={isArtist ? 'circle' : 'square'}
        onClose={() => setCropModalOpen(false)}
        onCropComplete={handleCropComplete}
      />

      <div
        className="moderation-modal-modal-background"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <div className="moderation-modal-modal-window moderation-modal">
          <div className="moderation-modal-modal-window-top-buttons">
            {moderationMode === 'review' ? (
              <button type="button" className="moderation-modal-modal-window-top-button moderation-modal-active">
                Модерация:{' '}
                {item.type === 'artist'
                  ? 'Исполнитель'
                  : item.type === 'album'
                    ? 'Альбом'
                    : 'Трек'}
              </button>
            ) : (
              <button
                type="button"
                className="moderation-modal-modal-window-top-button moderation-modal-active"
                onClick={() => setModerationMode('review')}
              >
                Причина отклонения
              </button>
            )}

            <button
              type="button"
              className="moderation-modal-modal-close-button"
              onClick={onClose}
              title="Закрыть"
            >
              <img src={closeIcon} alt="✕" />
            </button>
          </div>

          <div className="moderation-modal-modal-window-content">
            {moderationMode === 'review' && (
              <form className="moderation-modal-auth-form" onSubmit={(e) => e.preventDefault()}>
                <div className="moderation-preview">
                  <div className="moderation-cover">
                    <img
                      src={coverPreview || '/default.png'}
                      alt="Обложка"
                      className={`moderation-cover-img ${isArtist ? 'moderation-modal-circle' : 'rounded'}`}
                    />
                    <label className="moderation-cover-change">
                      <input
                        ref={coverInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleCoverSelect}
                      />
                      Изменить обложку
                    </label>
                  </div>
                </div>

                <div className="moderation-modal-auth-form-group">
                  <label>
                    {isArtist ? 'Имя исполнителя' : isAlbum ? 'Название альбома' : 'Название'} *
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={handleSingleTitleChange}
                    placeholder="Введите название"
                    disabled={loading}
                    required
                  />
                </div>

                {isArtist && (
                  <div className="moderation-modal-auth-form-group">
                    <div className="moderation-modal-genre-header-row">
                      <label className="moderation-modal-genre-header-label">Жанры исполнителя *</label>
                      {selectedGenres.length > 0 && (
                        <span className="moderation-modal-genre-selected-count">
                          Выбрано: {selectedGenres.length}
                        </span>
                      )}
                    </div>

                    <input
                      type="text"
                      className="moderation-modal-input-element moderation-modal-genre-search-input"
                      placeholder="Поиск жанра по названию..."
                      value={genreSearch}
                      onChange={(e) => setGenreSearch(e.target.value)}
                      disabled={loading}
                      
                    />

                    <div className="moderation-modal-genres-selector-list">
                      {filteredGenres.length === 0 ? (
                        <div className="moderation-modal-genre-empty-hint">
                          Жанр не найден
                        </div>
                      ) : (
                        filteredGenres.map((g) => {
                          const isSelected = selectedGenres.includes(g.key);
                          return (
                            <button
                              key={g.key}
                              type="button"
                              className={`moderation-modal-genre-chip-btn ${isSelected ? 'moderation-modal-active' : ''}`}
                              onClick={() => handleToggleGenre(g.key)}
                              disabled={loading}
                            >
                              {g.title_ru}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                {!isArtist && (
                  <div className="moderation-modal-auth-form-group">
                    <label>Год выпуска</label>
                    <input
                      type="number"
                      value={releaseYear}
                      onChange={(e) => setReleaseYear(e.target.value)}
                      placeholder="2026"
                      disabled={loading}
                    />
                  </div>
                )}

                {isSingleAudio && (
                  <AgeRestrictionToggle
                    checked={isAgeRestricted}
                    onChange={setIsAgeRestricted}
                    disabled={loading}
                  />
                )}

                {item.artist_info && (
                  <CollaboratorsManager
                    mainArtist={item.artist_info}
                    availableArtists={availableArtists}
                    collaboratorIds={collaborators}
                    onChange={setCollaborators}
                    disabled={loading}
                  />
                )}

                {isSingleAudio && (
                  <div className="moderation-modal-meta-box-card">
                    <div className="moderation-modal-meta-box-header">
                      <label className="moderation-modal-meta-switch-label">
                        <input
                          type="checkbox"
                          checked={isCover}
                          onChange={(e) => {
                            setIsCover(e.target.checked);
                            if (!e.target.checked) setOriginalTrackId(null);
                          }}
                          disabled={loading}
                        />
                        Кавер
                      </label>
                    </div>

                    {isCover && (
                      <OriginalTrackManager
                        availableTracks={availableTracks}
                        selectedTrackId={originalTrackId}
                        onChange={setOriginalTrackId}
                        disabled={loading}
                      />
                    )}
                  </div>
                )}

                {isSingleAudio && (
                  <div className="moderation-modal-auth-form-group">
                    <label>Аудиозапись</label>
                    <div className="moderation-single-audio-box">
                      <div className="moderation-single-audio-box-btn">
                        <button
                          type="button"
                          className="moderation-modal-track-slot-play-btn"
                          onClick={handlePlaySingle}
                          title={isSinglePlaying ? 'Пауза' : 'Слушать'}
                        >
                          <img
                            src={isSinglePlaying ? pauseIcon : playIcon}
                            alt="Play/Pause"
                          />
                        </button>
                      </div>

                      <label className="moderation-audio-change">
                        <input
                          type="file"
                          accept="audio/*"
                          onChange={(e) => setAudioFile(e.target.files[0])}
                        />
                        {audioFile
                          ? 'Файл выбран для замены'
                          : 'Заменить аудиофайл'}
                      </label>
                    </div>
                  </div>
                )}

                {isAlbum && (
                  <div className="moderation-modal-auth-form-group">
                    <label>Треки альбома ({tracks.length} шт.):</label>
                    <div className="moderation-modal-scrollable-track-list">
                      {tracks.map((track, idx) => (
                        <TrackSlotItem
                          key={track.id || idx}
                          index={idx}
                          track={track}
                          total={tracks.length}
                          onChange={handleTrackChange}
                          onMove={moveTrack}
                          onRemove={handleRemoveTrack}
                          showPlay
                          onPlay={handlePlayAlbumTrack}
                          isPlaying={currentTrack?.id === track.id && isPlaying}
                          disabled={loading}
                          availableArtists={availableArtists}
                          availableTracks={availableTracks}
                          mainArtist={item.artist_info}
                        />
                      ))}
                    </div>
                  </div>
                )}

                <div className="moderation-actions">
                  <Button
                    type="button"
                    variant="primary"
                    disabled={isApproveDisabled}
                    onClick={() => handleSubmit('approve')}
                  >
                    {loading ? 'Сохранение...' : 'Одобрить'}
                  </Button>

                  <Button
                    type="button"
                    variant="secondary"
                    disabled={loading}
                    onClick={() => setModerationMode('reject')}
                  >
                    Отклонить
                  </Button>
                </div>
              </form>
            )}

            {moderationMode === 'reject' && (
              <div className="moderation-modal-auth-form">
                <div className="moderation-reject-alert-row">
                  <img src={alertIcon} alt="Внимание" className="moderation-reject-alert-icon" />
                  <h3 className="moderation-reject-alert-title">
                    Укажите причину отклонения для автора
                  </h3>
                </div>

                <p className="moderation-modal-auth-form-subtitle moderation-reject-subtitle">
                  Автор получит уведомление с точной причиной отклонения релиза <strong>«{title || item.title || item.name}»</strong>:
                </p>

                <div>
                  <label className="moderation-reject-presets-label">
                    Готовые шаблоны:
                  </label>
                  <div className="moderation-modal-reject-presets">
                    {COMMON_REJECT_REASONS.map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        className={`moderation-modal-reject-preset-chip ${rejectReason === preset ? 'moderation-modal-active' : ''}`}
                        onClick={() => setRejectReason(preset)}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="moderation-modal-auth-form-group">
                  <label>Текст причины (обязательно) *</label>
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Опишите, что именно требуется исправить..."
                    required
                    disabled={loading}
                    className="moderation-modal-moderation-textarea moderation-reject-textarea"
                    autoFocus
                  />
                </div>

                <div className="moderation-modal-modal-actions-row">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={loading}
                    onClick={() => setModerationMode('review')}
                  >
                    Назад к проверке
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    disabled={loading || !rejectReason.trim()}
                    onClick={() => handleSubmit('reject', rejectReason)}
                  >
                    {loading ? 'Отклонение...' : 'Отклонить и отправить автору'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
