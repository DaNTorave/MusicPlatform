import React, { useEffect, useState, useCallback } from 'react';
import { HashRouter, Route, Routes, useLocation } from 'react-router-dom';
import { AudioProvider } from './context/AudioContext';
import { FavoritesProvider } from './context/FavoritesContext';
import { apiClient } from './api/apiClient';

import Header from './containers/Header';
import Footer from './components/Footer';
import Content from './containers/Content';
import ProfilePage from './containers/ProfilePage';
import ArtistPage from './containers/ArtistPage';
import AlbumPage from './containers/AlbumPage';
import ModerationPage from './containers/ModerationPage';
import RolesPage from './containers/RolesPage';
import TrackPage from './containers/TrackPage';
import PlayerPage from './containers/PlayerPage';
import GlobalPlayer from './components/GlobalPlayer';
import FavoritesPage from './containers/FavoritesPage';
import PlaylistsPage from './containers/PlaylistsPage';
import PlaylistPage from './containers/PlaylistPage';
import ArtistsPage from './containers/ArtistsPage';
import GenresPage from './containers/GenresPage';
import LegalPage from './containers/LegalPage';
import Modal from './containers/Modal';
import AuthModal from './components/AuthModal';
import Button from './components/Button';

import alertIcon from './assets/alert-circle.svg';

import './styles/App.css';

function AppLayout() {
  const location = useLocation();
  const isPlayerPage = location.pathname === '/player';
  const isLegalRoute =
    location.pathname === '/privacy' ||
    location.pathname === '/terms' ||
    location.pathname === '/copyright';

  const [currentUser, setCurrentUser] = useState(() => apiClient.getUser());
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState('login');
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [rejectedNotice, setRejectedNotice] = useState(false);

  const syncUserState = useCallback(() => {
    setCurrentUser(apiClient.getUser());
  }, []);

  const refreshUserStatus = useCallback(async () => {
    const token = apiClient.getToken();
    if (!token) {
      setCurrentUser(null);
      return;
    }

    setCheckingStatus(true);
    try {
      const res = await apiClient.fetchCurrentProfile();
      if (res?.user) {
        setCurrentUser(res.user);
        setRejectedNotice(false);
      }
    } catch (err) {
      if (err.status === 401) {
        apiClient.clearSession();
        setCurrentUser(null);
        setRejectedNotice(true);
      }
    } finally {
      setCheckingStatus(false);
    }
  }, []);

  useEffect(() => {
    refreshUserStatus();

    const handleLogin = () => {
      setRejectedNotice(false);
      syncUserState();
    };

    const handleUnauthorized = () => {
      syncUserState();
    };

    window.addEventListener('auth:login', handleLogin);
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    window.addEventListener('user:updated', syncUserState);

    return () => {
      window.removeEventListener('auth:login', handleLogin);
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
      window.removeEventListener('user:updated', syncUserState);
    };
  }, [refreshUserStatus, syncUserState]);

  useEffect(() => {
    if (!currentUser || currentUser.status === 'approved') return;

    const intervalId = setInterval(() => {
      if (document.visibilityState === 'visible') {
        refreshUserStatus();
      }
    }, 15000);

    return () => clearInterval(intervalId);
  }, [currentUser, refreshUserStatus]);

  useEffect(() => {
    const updateBodyScrollLock = () => {
      const hasOpenModal = document.querySelector('[class*="modal-background"]') !== null;
      if (hasOpenModal) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = '';
      }
    };

    updateBodyScrollLock();

    const observer = new MutationObserver(updateBodyScrollLock);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
      document.body.style.overflow = '';
    };
  }, []);

  const handleOpenAuth = (tab) => {
    setAuthModalTab(tab);
    setAuthModalOpen(true);
  };

  const handleLogoutPending = () => {
    apiClient.clearSession();
    setCurrentUser(null);
    window.dispatchEvent(new CustomEvent('auth:unauthorized'));
  };

  const isAuthenticated = Boolean(currentUser && apiClient.getToken());
  const isApproved = Boolean(isAuthenticated && currentUser.status === 'approved');

  const authTabs = [
    { id: 'login', label: 'Вход' },
    { id: 'register', label: 'Регистрация' },
  ];

  return (
    <>
      <Modal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        tabs={authTabs}
        activeTab={authModalTab}
        onTabChange={setAuthModalTab}
      >
        <AuthModal
          activeTab={authModalTab}
          onTabChange={setAuthModalTab}
          onSuccess={() => {
            setAuthModalOpen(false);
            syncUserState();
          }}
        />
      </Modal>

      <Header />

      {isLegalRoute ? (
        <main className="app-main">
          <Routes>
            <Route path="/privacy" element={<LegalPage initialDoc="privacy" />} />
            <Route path="/terms" element={<LegalPage initialDoc="terms" />} />
            <Route path="/copyright" element={<LegalPage initialDoc="copyright" />} />
          </Routes>
        </main>
      ) : !isAuthenticated ? (
        <main className="app-main app-main-gate">
          <div className="access-gate-card">
            <span className="access-gate-badge">Закрытый доступ • 18+</span>
            <h1 className="access-gate-title">Закрытая музыкальная платформа</h1>
            <p className="access-gate-desc">
              Просмотр каталога, прослушивание и загрузка аудиозаписей доступны только зарегистрированным участникам после одобрения заявки администратором.
            </p>

            {rejectedNotice && (
              <div className="access-gate-rejected-alert" role="alert">
                <img src={alertIcon} alt="Внимание" className="access-gate-alert-icon" />
                <span>
                  Ваша заявка на регистрацию была отклонена администратором, а учетная запись удалена.
                </span>
              </div>
            )}

            <div className="access-gate-actions">
              <Button
                type="button"
                variant="primary"
                fullWidth={false}
                onClick={() => handleOpenAuth('login')}
              >
                Войти в аккаунт
              </Button>
              <Button
                type="button"
                variant="secondary"
                fullWidth={false}
                onClick={() => handleOpenAuth('register')}
              >
                Подать заявку на регистрацию
              </Button>
            </div>
          </div>
        </main>
      ) : !isApproved ? (
        <main className="app-main app-main-gate">
          <div className="access-gate-card">
            <span className="access-gate-badge access-gate-badge-pending">
              На проверке
            </span>
            <h1 className="access-gate-title">
              Заявка на регистрацию рассматривается
            </h1>
            <p className="access-gate-desc">
              Здравствуйте, <strong>{currentUser.nickname || currentUser.login}</strong> (@{currentUser.login}). Ваша учетная запись находится на модерации у администраторов площадки. Как только заявка будет одобрена, вам откроется доступ ко всем материалам.
            </p>
            <p className="access-gate-subnote">
              В случае отклонения заявки учетная запись и введенные персональные данные будут автоматически удалены.
            </p>

            <div className="access-gate-actions">
              <Button
                type="button"
                variant="primary"
                fullWidth={false}
                disabled={checkingStatus}
                onClick={refreshUserStatus}
              >
                {checkingStatus ? 'Проверка...' : 'Проверить статус'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                fullWidth={false}
                onClick={handleLogoutPending}
              >
                Выйти
              </Button>
            </div>
          </div>
        </main>
      ) : (
        <>
          <main className={`app-main ${isPlayerPage ? 'app-main-player' : 'app-main-default'}`}>
            <Routes>
              <Route path="/" element={<Content />} />
              <Route path="/artists" element={<ArtistsPage />} />
              <Route path="/artists/:id/*" element={<ArtistPage />} />
              <Route path="/albums/:id" element={<AlbumPage />} />
              <Route path="/tracks/:id" element={<TrackPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/profile/:id" element={<ProfilePage />} />
              <Route path="/moderation" element={<ModerationPage />} />
              <Route path="/roles" element={<RolesPage />} />
              <Route path="/genres" element={<GenresPage />} />
              <Route path="/player" element={<PlayerPage />} />
              <Route path="/favorites" element={<FavoritesPage />} />
              <Route path="/playlists" element={<PlaylistsPage />} />
              <Route path="/playlists/:id" element={<PlaylistPage />} />
            </Routes>
          </main>
          {!isPlayerPage && <GlobalPlayer />}
        </>
      )}

      {!isPlayerPage && <Footer />}
    </>
  );
}

function App() {
  return (
    <FavoritesProvider>
      <AudioProvider>
        <HashRouter>
          <AppLayout />
        </HashRouter>
      </AudioProvider>
    </FavoritesProvider>
  );
}

export default App;