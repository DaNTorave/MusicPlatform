import React, { useState, useEffect, useMemo, useRef } from 'react';
import { apiClient } from '../api/apiClient';

import Modal from '../containers/Modal';
import Button from './Button';
import ImageCropModal from './ImageCropModal';
import defaultAvatar from '../assets/Шотландская веслоухая.jpg';

import '../styles/CreateArtistModal.css';


export default function CreateArtistModal({ isOpen, onClose, onSuccess }) {
  // Состояния полей формы и загрузки
  const [name, setName] = useState('');
  const [selectedGenres, setSelectedGenres] = useState([]);
  const [availableGenres, setAvailableGenres] = useState([]);
  const [genreSearch, setGenreSearch] = useState('');
  const [avatar, setAvatar] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Состояния модального окна кадрирования
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [rawImageSrc, setRawImageSrc] = useState('');
  const fileInputRef = useRef(null);

  // Загрузка списка жанров при инициализации
  useEffect(() => {
    if (isOpen === false) return;
    apiClient
      .getGenres()
      .then((res) => {
        if (res?.data) setAvailableGenres(res.data);
      })
      .catch(() => {});
    setGenreSearch('');
  }, [isOpen]);

  // Фильтрация жанров по поисковому запросу
  const filteredGenres = useMemo(() => {
    const q = genreSearch.trim().toLowerCase();
    if (!q) return availableGenres;
    return availableGenres.filter(
      (g) =>
        (g.title_ru && g.title_ru.toLowerCase().includes(q)) ||
        (g.key && g.key.toLowerCase().includes(q)),
    );
  }, [availableGenres, genreSearch]);

  // Выбор файла и открытие окна кадрирования
  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const objectUrl = URL.createObjectURL(file);
      setRawImageSrc(objectUrl);
      setCropModalOpen(true);
    }
    e.target.value = '';
  };

  // Завершение кадрирования аватара
  const handleCropComplete = (croppedFile, previewUrl) => {
    setAvatar(croppedFile);
    setAvatarPreview(previewUrl);
  };

  // Переключение выбора жанра
  const handleToggleGenre = (genreKey) => {
    setSelectedGenres((prev) =>
      prev.includes(genreKey)
        ? prev.filter((k) => k !== genreKey)
        : [...prev, genreKey],
    );
  };

  // Сброс всех полей формы
  const handleReset = () => {
    setName('');
    setSelectedGenres([]);
    setGenreSearch('');
    setAvatar(null);
    setAvatarPreview('');
    setRawImageSrc('');
    setErrorMsg('');
    setSuccessMsg('');
  };

  // Отправка данных нового исполнителя на сервер
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (selectedGenres.length === 0) {
      setErrorMsg('Выберите хотя бы один жанр из кластера');
      return;
    }

    setLoading(true);

    const formData = new FormData();
    formData.append('name', name.trim());
    formData.append('genre', selectedGenres.join(', '));
    selectedGenres.forEach((g) => formData.append('genres[]', g));
    if (avatar) formData.append('avatar', avatar);

    try {
      const response = await apiClient.upload('/api/upload/artist', formData);
      setSuccessMsg('Артист успешно отправлен на модерацию!');
      setTimeout(() => {
        handleReset();
        if (onSuccess) onSuccess(response.artist);
        if (onClose) onClose();
      }, 1200);
    } catch (err) {
      setErrorMsg(
        err.data?.error || err.message || 'Ошибка создания артиста',
      );
    } finally {
      setLoading(false);
    }
  };

  const formContent = (
    <>
      <ImageCropModal
        isOpen={cropModalOpen}
        imageSrc={rawImageSrc}
        cropShape="circle"
        onClose={() => setCropModalOpen(false)}
        onCropComplete={handleCropComplete}
      />

      <form className="create-artist-modal-auth-form" onSubmit={handleSubmit}>
        {errorMsg && <div className="create-artist-modal-auth-error-global">{errorMsg}</div>}
        {successMsg && <div className="create-artist-modal-auth-success-global">{successMsg}</div>}

        <div className="create-artist-modal-avatar-preview-container">
          <div className="create-artist-modal-avatar-preview-wrapper">
            <img
              src={avatarPreview || defaultAvatar}
              alt="Предпросмотр аватара"
              className="create-artist-modal-avatar-preview-image create-artist-modal-circle"
            />
            <label className="create-artist-modal-avatar-preview-badge">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                disabled={loading}
              />
              {avatarPreview ? 'Сменить' : 'Выбрать фото'}
            </label>
          </div>
        </div>

        <div className="create-artist-modal-auth-form-group">
          <label>Имя исполнителя / Название группы *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Например: Queen, Miyagi..."
            required
            disabled={loading}
          />
        </div>

        <div className="create-artist-modal-auth-form-group">
          <div className="create-artist-modal-genre-header-row">
            <label className="create-artist-modal-genre-header-label">Жанры артиста *</label>
            {selectedGenres.length > 0 && (
              <span className="create-artist-modal-genre-selected-count">
                Выбрано: {selectedGenres.length}
              </span>
            )}
          </div>

          <input
            type="text"
            className="create-artist-modal-input-element create-artist-modal-genre-search-input"
            placeholder="Поиск жанра по названию..."
            value={genreSearch}
            onChange={(e) => setGenreSearch(e.target.value)}
            disabled={loading}
          />

          <div className="create-artist-modal-genres-selector-list">
            {filteredGenres.length === 0 ? (
              <div className="create-artist-modal-genre-empty-hint">Жанр не найден</div>
            ) : (
              filteredGenres.map((g) => {
                const isSelected = selectedGenres.includes(g.key);
                return (
                  <button
                    key={g.key}
                    type="button"
                    className={`create-artist-modal-genre-chip-btn ${isSelected ? 'create-artist-modal-active' : ''}`}
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

        <Button
          type="submit"
          variant="primary"
          disabled={loading || !name.trim() || selectedGenres.length === 0}
        >
          {loading ? 'Создание...' : 'Отправить на модерацию'}
        </Button>
      </form>
    </>
  );

  // Отрисовка внутри контейнера Modal при передаче пропса isOpen
  if (isOpen !== undefined) {
    return (
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        tabs={[{ id: 'create_artist', label: 'Новый исполнитель' }]}
        activeTab="create_artist"
        size="narrow"
      >
        {formContent}
      </Modal>
    );
  }

  return formContent;
}
