import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiClient } from '../api/apiClient';
import { useAudioPlayer } from '../context/AudioContext';
import { useFavorites } from '../context/FavoritesContext';

import TrackRow from '../components/TrackRow';
import ChangeNicknameModal from '../components/ChangeNicknameModal';
import ChangePasswordModal from '../components/ChangePasswordModal';
import PlaylistModal from '../components/PlaylistModal';
import PreferencesStepModal from '../components/PreferencesStepModal';
import ImageCropModal from '../components/ImageCropModal';

import defaultAvatar from '../assets/Шотландская веслоухая.jpg';
import userIcon from '../assets/user-svgrepo-com.svg';

import '../styles/ProfilePage.css';

export default function ProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { playTrack, currentTrack, isPlaying } = useAudioPlayer();
  const { toggleFavorite } = useFavorites();

  const [profile, setProfile] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [playlists, setPlaylists] = useState([]);
  const [favorites, setFavorites] = useState([]);

  // Управление модальными окнами
  const [activeModal, setActiveModal] = useState(null);

  // Кадрирование круглого аватара пользователя
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [rawImageSrc, setRawImageSrc] = useState('');
  const fileInputRef = useRef(null);

  // Определение принадлежности профиля текущему авторизованному аккаунту
  const isOwnProfile = !id || (currentUser && String(currentUser.id) === String(id));

  // Форматирование даты регистрации
  const formatRegistrationDate = (dateString) => {
    if (!dateString) return 'Не указана';
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  // Загрузка данных профиля, избранного и плейлистов
  const fetchProfileData = async () => {
    setLoading(true);
    try {
      const authUser = apiClient.getUser();
      setCurrentUser(authUser);

      const targetId = id || (authUser ? authUser.id : null);
      if (!targetId) {
        navigate('/');
        return;
      }

      const ownProfile = !id || (authUser && String(authUser.id) === String(id));
      const profileEndpoint = ownProfile
        ? '/api/profile'
        : `/api/profile/${targetId}`;

      const requests = [
        apiClient.request(profileEndpoint, {
          method: 'GET',
          requireAuth: true,
        }),
        apiClient.getUserPlaylists(targetId),
      ];

      if (ownProfile && authUser) {
        requests.push(apiClient.getFavorites(12));
      }

      const [res, playlistsRes, favoritesRes] = await Promise.all(requests);

      const profileData = res?.user || res?.profile;
      if (profileData) {
        setProfile(profileData);
      }

      if (playlistsRes?.data) {
        setPlaylists(playlistsRes.data);
      }

      if (ownProfile && favoritesRes?.data) {
        setFavorites(favoritesRes.data);
      } else {
        setFavorites([]);
      }
    } catch (err) {
      console.error('Ошибка загрузки профиля:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfileData();
  }, [id]);

  // Синхронизация списка избранного при снятии отметки
  const handleToggleFavorite = async (trackId) => {
    await toggleFavorite(trackId);
    setFavorites((prev) => prev.filter((t) => String(t.id) !== String(trackId)));
  };

  // Обработка выбора файла аватара с открытием кадрирования
  const handleAvatarFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setRawImageSrc(URL.createObjectURL(file));
      setCropModalOpen(true);
    }
    e.target.value = '';
  };

  // Отправка вырезанного аватара на сервер
  const handleCropComplete = async (croppedFile) => {
    setAvatarLoading(true);
    const formData = new FormData();
    formData.append('avatar', croppedFile);

    try {
      const response = await apiClient.upload('/api/profile/avatar', formData);
      if (response?.user) {
        apiClient.setUser(response.user);
        setCurrentUser(response.user);
        setProfile((prev) => ({ ...prev, avatar: response.user.avatar }));
        window.dispatchEvent(new CustomEvent('user:updated'));
      }
    } catch (err) {
      alert(err.data?.error || err.message || 'Ошибка загрузки аватара');
    } finally {
      setAvatarLoading(false);
    }
  };

  // Сохранение обновленных предпочтений
  const handleSavePreferences = async (genres, artistIds) => {
    try {
      const res = await apiClient.updatePreferences(genres, artistIds);
      if (res?.user) {
        apiClient.setUser(res.user);
        setCurrentUser(res.user);
        setProfile((prev) => ({
          ...prev,
          preferred_genres: res.user.preferred_genres,
          preferred_artist_ids: res.user.preferred_artist_ids,
        }));
        window.dispatchEvent(new CustomEvent('user:updated'));
      }
      setActiveModal(null);
    } catch (err) {
      alert(err.message || 'Ошибка обновления предпочтений');
    }
  };

  if (loading) {
    return <div className="profile-page-artist-page-state">Загрузка профиля...</div>;
  }

  if (!profile) {
    return <div className="profile-page-artist-page-state">Пользователь не найден</div>;
  }

  const avatarSrc =
    profile.avatar && profile.avatar.trim() !== ''
      ? profile.avatar
      : userIcon;

  const roleClass = `${(profile.role || 'member').toLowerCase()}`;

  return (
    <>
      <ImageCropModal
        isOpen={cropModalOpen}
        imageSrc={rawImageSrc}
        cropShape="circle"
        onClose={() => setCropModalOpen(false)}
        onCropComplete={handleCropComplete}
      />

      <ChangeNicknameModal
        isOpen={activeModal === 'nickname'}
        currentNickname={profile.nickname || profile.login}
        onClose={() => setActiveModal(null)}
        onNicknameUpdated={(updatedUser) => {
          setProfile((prev) => ({ ...prev, nickname: updatedUser.nickname }));
          window.dispatchEvent(new CustomEvent('user:updated'));
        }}
      />

      <ChangePasswordModal
        isOpen={activeModal === 'password'}
        onClose={() => setActiveModal(null)}
      />

      <PreferencesStepModal
        isOpen={activeModal === 'preferences'}
        initialGenres={profile.preferred_genres || []}
        initialArtistIds={profile.preferred_artist_ids || []}
        onClose={() => setActiveModal(null)}
        onComplete={handleSavePreferences}
      />

      <PlaylistModal
        isOpen={activeModal === 'create_playlist'}
        onClose={() => setActiveModal(null)}
        onSuccess={() => fetchProfileData()}
      />

      <div className="profile-page">
        <div className="profile-layout">
          {/* Левая колонка: информация о пользователе и настройки */}
          <aside className="profile-sidebar">
            <div className="profile-header">
              <div className="profile-avatar">
                <img
                  src={avatarSrc}
                  alt="Avatar"
                />
                {isOwnProfile && (
                  <label className="profile-avatar-edit-badge" title="Сменить аватар">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="profile-avatar-file-input"
                      onChange={handleAvatarFileSelect}
                      disabled={avatarLoading}
                    />
                    {avatarLoading ? '...' : 'Фото'}
                  </label>
                )}
              </div>

              <div className="profile-info">
                <h1>{profile.nickname || profile.login}</h1>
                <div className="profile-login">@{profile.login}</div>

                <div className="profile-badge">
                  <span className={`profile-page-role-badge ${roleClass}`}>
                    {profile.role || 'member'}
                  </span>
                  {profile.is_premium && (
                    <span className="premium-badge">PREMIUM</span>
                  )}
                </div>
              </div>
            </div>

            <div className="profile-details">
              {isOwnProfile && profile.email && (
                <div className="detail-item">
                  <span className="detail-label">Электронная почта</span>
                  <span className="detail-value">{profile.email}</span>
                </div>
              )}
              <div className="detail-item">
                <span className="detail-label">Дата регистрации</span>
                <span className="detail-value">
                  {formatRegistrationDate(profile.inserted_at)}
                </span>
              </div>
            </div>

            {isOwnProfile && (
              <div className="profile-actions">
                <button
                  type="button"
                  className="profile-action-btn"
                  onClick={() => setActiveModal('nickname')}
                >
                  Сменить никнейм
                </button>
                <button
                  type="button"
                  className="profile-action-btn"
                  onClick={() => setActiveModal('password')}
                >
                  Сменить пароль
                </button>
                <button
                  type="button"
                  className="profile-action-btn"
                  onClick={() => setActiveModal('preferences')}
                >
                  Настроить предпочтения
                </button>
              </div>
            )}
          </aside>

          {/* Правая колонка: избранное и плейлисты */}
          <div className="profile-content">
            {isOwnProfile && (
              <div className="profile-favorites-section profile-section-first">
                <div className="profile-favorites-header">
                  <div>
                    <h2 className="profile-favorites-title">Избранное</h2>
                    <span className="profile-favorites-subtitle">
                      Последние добавленные треки
                    </span>
                  </div>
                  <button
                    type="button"
                    className="profile-show-all-btn"
                    onClick={() => navigate('/favorites')}
                  >
                    Смотреть все
                  </button>
                </div>

                {favorites.length === 0 ? (
                  <p className="profile-page-empty-text">
                    В избранном пока нет треков
                  </p>
                ) : (
                  <div className="profile-favorites-list">
                    {favorites.map((track, idx) => (
                      <TrackRow
                        key={track.id}
                        index={idx}
                        track={track}
                        isPlaying={
                          currentTrack &&
                          String(currentTrack.id) === String(track.id) &&
                          isPlaying
                        }
                        onPlay={() => playTrack(track, favorites)}
                        isFavorite={true}
                        onToggleFavorite={handleToggleFavorite}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            <div
              className={`profile-favorites-section ${!isOwnProfile ? 'profile-section-first' : ''}`}
            >
              <div className="profile-favorites-header">
                <div>
                  <h2 className="profile-favorites-title">
                    Публичные плейлисты
                  </h2>
                  <span className="profile-favorites-subtitle">
                    {playlists.length} доступно для прослушивания
                  </span>
                </div>
                {isOwnProfile && (
                  <button
                    type="button"
                    className="profile-show-all-btn"
                    onClick={() => setActiveModal('create_playlist')}
                  >
                    + Создать плейлист
                  </button>
                )}
              </div>

              {playlists.length === 0 ? (
                <p className="profile-page-empty-text">Нет доступных плейлистов</p>
              ) : (
                <div className="playlists-grid">
                  {playlists.map((pl) => (
                    <div
                      key={pl.id}
                      className="playlist-card"
                      onClick={() => navigate(`/playlists/${pl.id}`)}
                    >
                      <img
                        src={pl.cover || defaultAvatar}
                        alt={pl.title}
                        className="playlist-card-cover"
                      />
                      <div className="playlist-card-info">
                        <h3 className="playlist-card-title">{pl.title}</h3>
                        <span className="playlist-card-count">
                          {pl.tracks_count || 0} треков
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}