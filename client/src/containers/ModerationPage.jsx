import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../api/apiClient';
import { formatEntityType } from '../hooks/formatters';

import Button from '../components/Button';
import ModerationModal from '../components/ModerationModal';

import defaultAvatar from '../assets/user-svgrepo-com.svg';

import '../styles/ModerationPage.css';

export default function ModerationPage() {
  const [activeTab, setActiveTab] = useState('content'); // 'content' | 'users'
  const [pendingItems, setPendingItems] = useState([]);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [canModerateUsers, setCanModerateUsers] = useState(false);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [userActionId, setUserActionId] = useState(null);
  const [error, setError] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);

  const loadPending = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.request('/api/moderation/pending', {
        method: 'GET',
        requireAuth: true,
      });
      setPendingItems(data.items || []);
      setPendingUsers(data.pending_users || []);
      setCanModerateUsers(Boolean(data.can_moderate_users));
    } catch (err) {
      setError(
        err.data?.error || err.message || 'Ошибка загрузки списка модерации',
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPending();
  }, []);

  // Одобрение контента с возможными правками
  const handleApprove = async (formData) => {
    setActionLoading(true);
    try {
      await apiClient.upload('/api/moderation/approve-with-edit', formData);
      setSelectedItem(null);
      await loadPending();
    } catch (err) {
      alert(err.data?.error || err.message || 'Не удалось одобрить');
    } finally {
      setActionLoading(false);
    }
  };

  // Отклонение контента
  const handleReject = async (schema, id, comment) => {
    setActionLoading(true);
    try {
      await apiClient.request('/api/moderation/decision', {
        method: 'POST',
        requireAuth: true,
        data: { schema, id, status: 'rejected', comment },
      });
      setSelectedItem(null);
      await loadPending();
    } catch (err) {
      alert(err.data?.error || err.message || 'Не удалось отклонить');
    } finally {
      setActionLoading(false);
    }
  };

  // Принятие или отклонение заявки пользователя на регистрацию
  const handleUserDecision = async (user, action) => {
    const confirmText =
      action === 'approve'
        ? `Одобрить регистрацию пользователя @${user.login} (${user.email})?`
        : `Отклонить заявку пользователя @${user.login} и удалить его запись из базы данных?`;

    if (!window.confirm(confirmText)) return;

    setUserActionId(user.id);
    try {
      await apiClient.moderateUserRegistration(user.id, action);
      await loadPending();
    } catch (err) {
      alert(err.data?.error || err.message || 'Ошибка обработки заявки пользователя');
    } finally {
      setUserActionId(null);
    }
  };

  const formatDate = (isoString) => {
    if (!isoString) return '';
    return new Date(isoString).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="moderation-page-content-page">
        <p className="moderation-page-status-message">Загрузка очереди...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="moderation-page-content-page">
        <p className="error-text">{error}</p>
      </div>
    );
  }

  return (
    <>
      <ModerationModal
        isOpen={Boolean(selectedItem)}
        onClose={() => setSelectedItem(null)}
        item={selectedItem}
        onApprove={handleApprove}
        onReject={handleReject}
        loading={actionLoading}
      />

      <div className="moderation-page-content-page moderation-page-content">
        <div className="moderation-header">
          <h2>Панель модерации</h2>
          <Button variant="secondary" fullWidth={false} onClick={loadPending}>
            Обновить
          </Button>
        </div>

        {/* Переключение вкладок: Контент / Регистрации пользователей */}
        <div className="moderation-tabs-bar">
          <button
            type="button"
            className={`moderation-tab-btn ${activeTab === 'content' ? 'moderation-tab-active' : ''}`}
            onClick={() => setActiveTab('content')}
          >
            <span>Музыка и артисты</span>
            {pendingItems.length > 0 && (
              <span className="moderation-tab-counter">{pendingItems.length}</span>
            )}
          </button>

          {canModerateUsers && (
            <button
              type="button"
              className={`moderation-tab-btn ${activeTab === 'users' ? 'moderation-tab-active' : ''}`}
              onClick={() => setActiveTab('users')}
            >
              <span>Заявки на регистрацию</span>
              {pendingUsers.length > 0 && (
                <span className="moderation-tab-counter moderation-tab-counter-users">
                  {pendingUsers.length}
                </span>
              )}
            </button>
          )}
        </div>

        {/* Вкладка 1: Модерация контента */}
        {activeTab === 'content' && (
          <>
            {pendingItems.length === 0 ? (
              <p className="moderation-page-empty-catalog-text">
                Очередь модерации контента пуста.
              </p>
            ) : (
              <div className="moderation-list">
                {pendingItems.map((item) => {
                  const author = item.creator_info;
                  const artist = item.artist_info;

                  return (
                    <div
                      key={`${item.type}-${item.id}`}
                      className="moderation-card"
                    >
                      <img
                        src={item.cover || item.avatar || '/default.png'}
                        alt="preview"
                        className="moderation-card-preview"
                      />

                      <div className="moderation-card-info">
                        <span className="moderation-card-type">
                          [{formatEntityType(item.type)}]
                        </span>
                        <h3 className="moderation-card-title">
                          {item.title || item.name}
                        </h3>

                        {artist && (
                          <p className="moderation-card-artist">
                            Артист:{' '}
                            <Link
                              to={`/artists/${artist.id}`}
                              className="moderation-link"
                            >
                              {artist.name}
                            </Link>
                          </p>
                        )}

                        {item.type === 'album' && item.tracks && (
                          <p className="moderation-card-tracks">
                            Количество треков в альбоме:{' '}
                            <strong>{item.tracks.length}</strong>
                          </p>
                        )}

                        <p className="moderation-card-author">
                          Автор заявки:{' '}
                          {author ? (
                            <Link
                              to={`/profile/${author.id}`}
                              className="moderation-link-bold"
                            >
                              {author.nickname || author.login} (@{author.login})
                            </Link>
                          ) : (
                            <span>ID: {item.creator_id}</span>
                          )}
                          {item.genre ? ` • Жанр: ${item.genre}` : ''}
                        </p>
                      </div>

                      <Button
                        variant="primary"
                        fullWidth={false}
                        onClick={() => setSelectedItem(item)}
                        disabled={actionLoading}
                      >
                        Взять на модерацию
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Вкладка 2: Одобрение или отклонение новых пользователей */}
        {activeTab === 'users' && canModerateUsers && (
          <>
            {pendingUsers.length === 0 ? (
              <p className="moderation-page-empty-catalog-text">
                Новых заявок на регистрацию нет.
              </p>
            ) : (
              <div className="moderation-list">
                {pendingUsers.map((u) => {
                  const isBusy = userActionId === u.id;

                  return (
                    <div key={`user-${u.id}`} className="moderation-card">
                      <img
                        src={u.avatar || defaultAvatar}
                        alt={u.login}
                        className="moderation-user-avatar-preview"
                      />

                      <div className="moderation-card-info">
                        <span className="moderation-card-type">
                          [Заявка на доступ]
                        </span>
                        <h3 className="moderation-card-title">
                          {u.nickname || u.login}{' '}
                          <span className="moderation-user-login-tag">
                            (@{u.login})
                          </span>
                        </h3>
                        <p className="moderation-card-artist">
                          Email: {u.email}
                        </p>
                        <p className="moderation-card-author">
                          Дата подачи: {formatDate(u.inserted_at)} • Согласия 152-ФЗ получены
                        </p>
                      </div>

                      <div className="moderation-user-actions">
                        <Button
                          type="button"
                          variant="primary"
                          fullWidth={false}
                          disabled={isBusy}
                          onClick={() => handleUserDecision(u, 'approve')}
                        >
                          {isBusy ? '...' : 'Принять'}
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          fullWidth={false}
                          disabled={isBusy}
                          onClick={() => handleUserDecision(u, 'reject')}
                        >
                          Отклонить
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}