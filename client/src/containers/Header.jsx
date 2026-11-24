import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { apiClient } from '../api/apiClient';

import Button from '../components/Button';
import Modal from './Modal';
import AuthModal from '../components/AuthModal';
import UploadMusicModal from '../components/UploadMusicModal';
import NotificationsModal from '../components/NotificationsModal';

import logo from '../assets/logo.png';
import userIcon from '../assets/user-svgrepo-com.svg';

import '../styles/Header.css';

export default function Header() {
  const [activeModal, setActiveModal] = useState(null);
  const [authTab, setAuthTab] = useState('login');
  const [uploadTab, setUploadTab] = useState('single');
  const [toastNotification, setToastNotification] = useState(null);

  const [user, setUser] = useState(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const dropdownRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  const loadUnreadCount = useCallback(async () => {
    const current = apiClient.getUser();
    if (!apiClient.getToken() || !current || current.status !== 'approved') {
      setUnreadCount(0);
      return;
    }

    try {
      const res = await apiClient.request('/api/notifications', {
        method: 'GET',
        requireAuth: true,
      });
      if (Array.isArray(res?.notifications)) {
        const count = res.notifications.filter((n) => !n.is_read).length;
        setUnreadCount(count);
      }
    } catch (e) {
      // Игнорируем сетевые ошибки опроса
    }
  }, []);

  useEffect(() => {
    const currentUser = apiClient.getUser();
    if (currentUser) {
      setUser(currentUser);
      loadUnreadCount();
    }

    const handleAuthChange = () => {
      const updatedUser = apiClient.getUser();
      setUser(updatedUser);
      if (updatedUser) loadUnreadCount();
      else setUnreadCount(0);
    };

    const handleNotificationsChange = () => {
      loadUnreadCount();
    };

    const handleStorageChange = (e) => {
      if (e.key === 'user' || e.key === 'authToken') {
        handleAuthChange();
      }
      if (e.key === 'user_notifications') {
        handleNotificationsChange();
      }
    };

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible' && apiClient.getToken()) {
        loadUnreadCount();
      }
    };

    window.addEventListener('auth:unauthorized', handleAuthChange);
    window.addEventListener('auth:login', handleAuthChange);
    window.addEventListener('user:updated', handleAuthChange);
    window.addEventListener('notifications:update', handleNotificationsChange);
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      window.removeEventListener('auth:unauthorized', handleAuthChange);
      window.removeEventListener('auth:login', handleAuthChange);
      window.removeEventListener('user:updated', handleAuthChange);
      window.removeEventListener(
        'notifications:update',
        handleNotificationsChange,
      );
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [loadUnreadCount]);

  useEffect(() => {
    if (!user || user.status !== 'approved') return;

    const intervalId = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadUnreadCount();
      }
    }, 8000);

    return () => clearInterval(intervalId);
  }, [user, loadUnreadCount]);

  useEffect(() => {
    if (user && user.status === 'approved') {
      loadUnreadCount();
    }
  }, [location.pathname, user, loadUnreadCount]);

  const showNotification = (msg) => {
    setToastNotification(msg);
    setTimeout(() => {
      setToastNotification(null);
    }, 8000);
  };

  const handleLoginSuccess = () => {
    const currentUser = apiClient.getUser();
    setUser(currentUser);
    setActiveModal(null);
    setIsDropdownOpen(false);
    loadUnreadCount();
  };

  const handleLogout = () => {
    apiClient.clearSession();
    setUser(null);
    setUnreadCount(0);
    setIsDropdownOpen(false);
    window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    navigate('/');
  };

  const handleProfileClick = () => {
    setIsDropdownOpen(false);
    navigate('/profile');
  };

  const handleUserClick = () => {
    if (user) {
      const nextOpen = !isDropdownOpen;
      setIsDropdownOpen(nextOpen);
      if (nextOpen && user.status === 'approved') {
        loadUnreadCount();
      }
    } else {
      setAuthTab('login');
      setActiveModal('auth');
    }
  };

  const handleNotificationsClick = () => {
    setIsDropdownOpen(false);
    setActiveModal('notifications');
  };

  const isApproved = Boolean(user && user.status === 'approved');
  const displayName = user ? user.nickname || user.login : null;
  const canManageRoles =
    isApproved && (user.role === 'owner' || user.role === 'admin');
  const isStaff =
    isApproved &&
    (user.role === 'owner' ||
      user.role === 'admin' ||
      user.role === 'moderator');

  const avatarSrc =
    user && user.avatar && user.avatar.trim() !== '' ? user.avatar : userIcon;
  const isCustomAvatar = Boolean(
    user && user.avatar && user.avatar.trim() !== '',
  );

  const authTabs = [
    { id: 'login', label: 'Вход' },
    { id: 'register', label: 'Регистрация' },
  ];

  const uploadTabs = [
    { id: 'single', label: 'Сингл' },
    { id: 'album', label: 'Альбом' },
    { id: 'artist', label: 'Артист' },
  ];

  return (
    <>
      <Modal
        isOpen={activeModal === 'auth'}
        onClose={() => setActiveModal(null)}
        tabs={authTabs}
        activeTab={authTab}
        onTabChange={setAuthTab}
        notification={toastNotification}
        onClearNotification={() => setToastNotification(null)}
      >
        <AuthModal
          activeTab={authTab}
          onTabChange={setAuthTab}
          onSuccess={handleLoginSuccess}
          onShowNotification={showNotification}
        />
      </Modal>

      <Modal
        isOpen={activeModal === 'upload'}
        onClose={() => setActiveModal(null)}
        tabs={uploadTabs}
        activeTab={uploadTab}
        onTabChange={setUploadTab}
        size="wide"
        scrollable={true}
      >
        <UploadMusicModal
          uploadType={uploadTab}
          onUploadTypeChange={setUploadTab}
          onClose={() => setActiveModal(null)}
          onSuccess={() => {
            loadUnreadCount();
          }}
        />
      </Modal>

      <NotificationsModal
        isOpen={activeModal === 'notifications'}
        onClose={() => {
          setActiveModal(null);
          loadUnreadCount();
        }}
        onOpenUpload={() => {
          setUploadTab('single');
          setActiveModal('upload');
        }}
      />

      <header className="header">
        <div
          className="header-title-with-logo-block"
          onClick={() => navigate('/')}
        >
          <img className="header-logo" src={logo} alt="Логотип" />
          <p className="header-title">Music Platform</p>
        </div>

        <div className="header-user-block" ref={dropdownRef}>
          <div className="user-menu-container">
            <Button
              type="button"
              variant="user-header"
              fullWidth={false}
              onClick={handleUserClick}
            >
              <img
                className={`user-icon ${isCustomAvatar ? 'user-avatar-image' : ''}`}
                src={avatarSrc}
                alt={user ? displayName : 'Пользователь'}
              />
              <span>{user ? displayName : 'Войти'}</span>
            </Button>

            {user && isDropdownOpen && (
              <div className="user-dropdown">
                {isApproved && (
                  <>
                    <button
                      type="button"
                      className="dropdown-item"
                      onClick={handleProfileClick}
                    >
                      <span>Профиль</span>
                    </button>

                    {canManageRoles && (
                      <button
                        type="button"
                        className="dropdown-item"
                        onClick={() => {
                          setIsDropdownOpen(false);
                          navigate('/roles');
                        }}
                      >
                        <span>Управление ролями</span>
                      </button>
                    )}

                    {isStaff && (
                      <button
                        type="button"
                        className="dropdown-item"
                        onClick={() => {
                          setIsDropdownOpen(false);
                          navigate('/moderation');
                        }}
                      >
                        <span>Модерация</span>
                      </button>
                    )}

                    <button
                      type="button"
                      className="dropdown-item"
                      onClick={handleNotificationsClick}
                    >
                      <span>Уведомления</span>
                      {unreadCount > 0 && (
                        <span className="dropdown-badge-counter">
                          {unreadCount}
                        </span>
                      )}
                    </button>

                    {user.role === 'owner' && (
                      <button
                        type="button"
                        className="dropdown-item"
                        onClick={() => {
                          setIsDropdownOpen(false);
                          navigate('/genres');
                        }}
                      >
                        <span>Кластер жанров</span>
                      </button>
                    )}

                    <div className="dropdown-divider"></div>
                  </>
                )}

                <button
                  type="button"
                  className="dropdown-item logout"
                  onClick={handleLogout}
                >
                  <span>Выйти</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
    </>
  );
}