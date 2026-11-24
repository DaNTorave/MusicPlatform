import React, { useState, useEffect } from 'react';
import { useMutation } from '../hooks/useApi';
import { apiClient } from '../api/apiClient';

import InputField from './InputField';
import Button from './Button';
import { PreferencesFormContent } from './PreferencesStepModal';
import LegalModal from './LegalModal';

import eye from '../assets/eye.svg';
import eye_crossed from '../assets/eye-crossed.svg';

import '../styles/AuthModal.css';

export default function AuthModal({
  activeTab = 'login',
  onTabChange,
  onSuccess,
}) {
  // Состояния для режима входа
  const [loginOrEmail, setLoginOrEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // Состояния для режима регистрации
  const [regStep, setRegStep] = useState('credentials');
  const [regLogin, setRegLogin] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regNickname, setRegNickname] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);

  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);
  const [regFieldError, setRegFieldError] = useState('');
  const [isRegistrationComplete, setIsRegistrationComplete] = useState(false);
  const [preferredGenres, setPreferredGenres] = useState([]);
  const [preferredArtistIds, setPreferredArtistIds] = useState([]);

  // Проверка уникальности логина на сервере
  const [loginCheckStatus, setLoginCheckStatus] = useState('idle'); // 'idle' | 'checking' | 'available' | 'taken'

  // Модальное окно с юридическими документами
  const [legalDocModal, setLegalDocModal] = useState(null);

  // Ошибки валидации полей регистрации
  const [regErrors, setRegErrors] = useState({
    login: '',
    email: '',
    nickname: '',
    password: '',
    confirmPassword: '',
    legal: '',
  });

  // Сброс локальных ошибок при переключении вкладки
  useEffect(() => {
    setLoginError('');
    setRegFieldError('');
    if (activeTab !== 'register') {
      setRegStep('credentials');
    }
  }, [activeTab]);

  // Проверка уникальности логина с задержкой при вводе
  useEffect(() => {
    if (activeTab !== 'register') return;
    const trimmed = regLogin.trim();

    if (!trimmed || trimmed.length < 3 || !/^[a-zA-Z0-9_]+$/.test(trimmed)) {
      setLoginCheckStatus('idle');
      return;
    }

    setLoginCheckStatus('checking');
    const timer = setTimeout(async () => {
      try {
        const res = await apiClient.checkLoginAvailability(trimmed);
        if (res?.available) {
          setLoginCheckStatus('available');
          setRegErrors((prev) => ({ ...prev, login: '' }));
        } else {
          setLoginCheckStatus('taken');
          setRegErrors((prev) => ({
            ...prev,
            login: res?.error || 'Этот логин уже занят',
          }));
        }
      } catch {
        setLoginCheckStatus('idle');
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [regLogin, activeTab]);

  // Мутация авторизации пользователя
  const { mutate: mutateLogin, loading: loadingLogin } = useMutation(
    '/api/login',
    {
      method: 'POST',
      onSuccess: (data) => {
        if (data.token) apiClient.setToken(data.token);
        if (data.user) apiClient.setUser(data.user);
        if (onSuccess) onSuccess();
      },
      onError: (err) => {
        let errorMessage = '';
        if (err.status === 401) {
          errorMessage = 'Неверный логин или пароль';
        } else if (err.status === 400) {
          errorMessage =
            err.data?.error || err.message || 'Некорректные данные';
        } else if (err.status === 422) {
          errorMessage = 'Ошибка валидации данных';
        } else if (err.isCorsError) {
          errorMessage =
            'Ошибка подключения к серверу. Проверьте настройки CORS.';
        } else if (err.isNetworkError) {
          errorMessage = 'Нет соединения с сервером. Проверьте интернет.';
        } else if (err.isTimeout) {
          errorMessage = 'Сервер не отвечает. Попробуйте позже.';
        } else {
          errorMessage = err.message || 'Произошла ошибка при входе';
        }
        setLoginError(errorMessage);
      },
    },
  );

  // Мутация регистрации с сохранением сессии в статусе pending
  const { mutate: mutateRegister, loading: loadingRegister } = useMutation(
    '/api/register',
    {
      method: 'POST',
      onSuccess: (data) => {
        setIsRegistrationComplete(true);
        if (data?.token) apiClient.setToken(data.token);
        if (data?.user) apiClient.setUser(data.user);
        if (onSuccess) onSuccess();
      },
      onError: (err) => {
        setRegStep('credentials');

        if (err.status === 400) {
          if (err.data?.errors) {
            const serverErrors = err.data.errors;
            const newErrors = {};
            let hasFieldErrors = false;

            const fieldMap = {
              login: 'login',
              email: 'email',
              nickname: 'nickname',
              password: 'password',
              terms_accepted: 'legal',
              privacy_accepted: 'legal',
            };

            Object.keys(serverErrors).forEach((key) => {
              const field = fieldMap[key];
              if (field) {
                const errorMsg = Array.isArray(serverErrors[key])
                  ? serverErrors[key][0]
                  : serverErrors[key];
                newErrors[field] = errorMsg;
                hasFieldErrors = true;
              }
            });

            if (hasFieldErrors) {
              setRegErrors((prev) => ({ ...prev, ...newErrors }));
            } else {
              setRegFieldError(err.data.error || 'Ошибка регистрации');
            }
          } else {
            setRegFieldError(err.data?.error || 'Некорректные данные');
          }
        } else if (err.isCorsError) {
          setRegFieldError(
            'Ошибка подключения к серверу. Проверьте настройки CORS.',
          );
        } else if (err.isNetworkError) {
          setRegFieldError('Нет соединения с сервером. Проверьте интернет.');
        } else if (err.isTimeout) {
          setRegFieldError('Сервер не отвечает. Попробуйте позже.');
        } else {
          setRegFieldError(err.message || 'Произошла ошибка при регистрации');
        }
      },
    },
  );

  // Обработка отправки формы входа
  const handleLoginSubmit = (e) => {
    e.preventDefault();
    setLoginError('');

    if (!loginOrEmail.trim()) {
      setLoginError('Введите имя пользователя или email');
      return;
    }

    if (!loginPassword) {
      setLoginError('Введите пароль');
      return;
    }

    mutateLogin({ login: loginOrEmail, password: loginPassword });
  };

  const getLoginInputType = () => {
    return loginOrEmail.includes('@') && loginOrEmail.includes('.')
      ? 'email'
      : 'text';
  };

  const getLoginPlaceholder = () => {
    return loginOrEmail.includes('@') && loginOrEmail.includes('.')
      ? 'example@mail.com'
      : 'Имя пользователя или email';
  };

  // Валидация поля формы регистрации
  const validateRegField = (field, value) => {
    let error = '';

    switch (field) {
      case 'login':
        if (!value.trim()) {
          error = 'Логин обязателен';
        } else if (value.length < 3) {
          error = 'Логин должен содержать не менее 3 символов';
        } else if (!/^[a-zA-Z0-9_]+$/.test(value)) {
          error =
            'Логин может содержать только латинские буквы, цифры и символ подчеркивания';
        }
        break;

      case 'email':
        if (!value.trim()) {
          error = 'Email обязателен';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          error = 'Введите корректный email адрес';
        }
        break;

      case 'nickname':
        if (value.trim() && value.length < 2) {
          error = 'Никнейм должен содержать не менее 2 символов';
        } else if (value.trim() && !/^[a-zA-Zа-яА-Я0-9_]+$/.test(value)) {
          error =
            'Никнейм может содержать только буквы, цифры и символ подчеркивания';
        }
        break;

      case 'password':
        if (!value.trim()) {
          error = 'Пароль обязателен';
        } else if (value.length < 8) {
          error = 'Пароль должен содержать не менее 8 символов';
        } else if (!/(?=.*[a-z])/.test(value) || !/(?=.*[A-Z])/.test(value)) {
          error = 'Пароль должен содержать прописные и строчные буквы';
        } else if (!/(?=.*\d)/.test(value)) {
          error = 'Пароль должен содержать как минимум одну цифру';
        }
        break;

      case 'confirmPassword':
        if (!value.trim()) {
          error = 'Подтверждение пароля обязательно';
        } else if (value !== regPassword) {
          error = 'Пароли не совпадают';
        }
        break;

      default:
        break;
    }

    return error;
  };

  const getPasswordStrength = (pwd) => {
    if (!pwd) return null;
    let score = 0;
    if (pwd.length >= 8) score++;
    if (pwd.length >= 12) score++;
    if (/(?=.*[a-z])/.test(pwd) && /(?=.*[A-Z])/.test(pwd)) score++;
    if (/(?=.*\d)/.test(pwd)) score++;
    if (/(?=.*[!@#$%^&*])/.test(pwd)) score++;

    if (score <= 2) return { label: 'Слабый', class: 'auth-modal-weak' };
    if (score <= 3) return { label: 'Средний', class: 'auth-modal-medium' };
    if (score <= 4) return { label: 'Сильный', class: 'auth-modal-strong' };
    return { label: 'Очень сильный', class: 'auth-modal-very-strong' };
  };

  const handleRegFieldChange = (field, value) => {
    const setters = {
      login: setRegLogin,
      email: setRegEmail,
      nickname: setRegNickname,
      password: setRegPassword,
      confirmPassword: setRegConfirmPassword,
    };
    setters[field](value);

    const error = validateRegField(field, value);
    setRegErrors((prev) => ({ ...prev, [field]: error }));

    if (field === 'password' && regConfirmPassword) {
      const confirmError =
        regConfirmPassword !== value ? 'Пароли не совпадают' : '';
      setRegErrors((prev) => ({ ...prev, confirmPassword: confirmError }));
    }
  };

  const handleProceedToPreferences = (e) => {
    e.preventDefault();
    setRegFieldError('');

    const fields = {
      login: regLogin,
      email: regEmail,
      nickname: regNickname,
      password: regPassword,
      confirmPassword: regConfirmPassword,
    };

    const newErrors = {};
    let hasError = false;

    Object.keys(fields).forEach((field) => {
      const error = validateRegField(field, fields[field]);
      if (error) {
        newErrors[field] = error;
        hasError = true;
      }
    });

    if (loginCheckStatus === 'taken') {
      newErrors.login = regErrors.login || 'Этот логин уже занят';
      hasError = true;
    }

    if (!termsAccepted || !privacyAccepted) {
      newErrors.legal =
        'Необходимо принять пользовательское соглашение и дать согласие на обработку персональных данных';
      hasError = true;
    }

    setRegErrors((prev) => ({ ...prev, ...newErrors }));

    if (hasError) {
      return;
    }

    setRegStep('preferences');
  };

  const handleCompleteRegistration = (genres, artistIds) => {
    setPreferredGenres(genres);
    setPreferredArtistIds(artistIds);

    mutateRegister({
      login: regLogin.trim(),
      email: regEmail.trim(),
      nickname: regNickname.trim(),
      password: regPassword,
      terms_accepted: termsAccepted,
      privacy_accepted: privacyAccepted,
      preferred_genres: genres,
      preferred_artist_ids: artistIds,
    });
  };

  // Отображение вкладки входа
  if (activeTab === 'login') {
    const isLoginEmpty = !loginOrEmail.trim() || !loginPassword;

    return (
      <form className="auth-modal-auth-form" onSubmit={handleLoginSubmit}>
        <h2 className="auth-modal-auth-form-title">Добро пожаловать!</h2>
        <p className="auth-modal-auth-form-subtitle">
          Вход в закрытый музыкальный клуб
        </p>

        {loginError && (
          <div className="auth-modal-auth-error-global" role="alert">
            {loginError}
          </div>
        )}

        <InputField
          id="login-email"
          label="Имя пользователя или Email"
          type={getLoginInputType()}
          placeholder={getLoginPlaceholder()}
          value={loginOrEmail}
          onChange={(e) => {
            setLoginOrEmail(e.target.value);
            setLoginError('');
          }}
          required
          disabled={loadingLogin}
          autoComplete="username"
          autoFocus
        />

        <InputField
          id="login-password"
          label="Пароль"
          type="password"
          placeholder="Введите пароль"
          value={loginPassword}
          onChange={(e) => {
            setLoginPassword(e.target.value);
            setLoginError('');
          }}
          required
          disabled={loadingLogin}
          autoComplete="current-password"
        />

        <Button
          type="submit"
          variant="primary"
          disabled={loadingLogin || isLoginEmpty}
          fullWidth
        >
          {loadingLogin ? (
            <>
              <span className="auth-modal-spinner"></span>
              Вход...
            </>
          ) : (
            'Войти'
          )}
        </Button>

        <div className="auth-modal-auth-form-footer">
          Нет доступа?{' '}
          <a onClick={() => onTabChange && onTabChange('register')}>
            Подать заявку на регистрацию
          </a>
        </div>
      </form>
    );
  }

  // Отображение вкладки регистрации
  if (activeTab === 'register') {
    const hasRegErrors = Object.values(regErrors).some((error) => error !== '');
    const isRegEmpty =
      !regLogin.trim() ||
      !regEmail.trim() ||
      !regPassword.trim() ||
      !regConfirmPassword.trim() ||
      !termsAccepted ||
      !privacyAccepted;
    const passwordStrength = getPasswordStrength(regPassword);

    return (
      <>
        <LegalModal
          isOpen={Boolean(legalDocModal)}
          initialDoc={legalDocModal || 'privacy'}
          onClose={() => setLegalDocModal(null)}
        />

        <div className="auth-modal-auth-form-wrapper">
          {regFieldError && (
            <div className="auth-modal-auth-error-global" role="alert">
              {regFieldError}
            </div>
          )}

          {isRegistrationComplete && (
            <div className="auth-modal-auth-success-global" role="alert">
              Заявка отправлена администратору. Ожидайте подтверждения.
            </div>
          )}

          {regStep === 'credentials' ? (
            <form className="auth-modal-auth-form" onSubmit={handleProceedToPreferences}>
              <h2 className="auth-modal-auth-form-title">Заявка на регистрацию</h2>
              <p className="auth-modal-auth-form-subtitle">
                Доступ к платформе открывается после проверки администратором
              </p>

              <div className="auth-modal-auth-form-group">
                <label htmlFor="register-login">
                  Логин <span className="auth-modal-required-star">*</span>
                </label>
                <input
                  id="register-login"
                  type="text"
                  placeholder="Уникальный логин (латиница, цифры, _)"
                  value={regLogin}
                  onChange={(e) => handleRegFieldChange('login', e.target.value)}
                  required
                  disabled={loadingRegister}
                  className={regErrors.login ? 'auth-modal-error' : ''}
                />
                {loginCheckStatus === 'checking' && !regErrors.login && (
                  <span className="auth-modal-login-status-checking">
                    Проверка доступности логина...
                  </span>
                )}
                {loginCheckStatus === 'available' && !regErrors.login && (
                  <span className="auth-modal-login-status-ok">
                    Логин свободен
                  </span>
                )}
                {regErrors.login && (
                  <span className="auth-modal-auth-error">{regErrors.login}</span>
                )}
              </div>

              <div className="auth-modal-auth-form-group">
                <label htmlFor="register-email">
                  Email <span className="auth-modal-required-star">*</span>
                </label>
                <input
                  id="register-email"
                  type="email"
                  placeholder="example@mail.com"
                  value={regEmail}
                  onChange={(e) => handleRegFieldChange('email', e.target.value)}
                  required
                  disabled={loadingRegister}
                  className={regErrors.email ? 'auth-modal-error' : ''}
                />
                {regErrors.email && (
                  <span className="auth-modal-auth-error">{regErrors.email}</span>
                )}
              </div>

              <div className="auth-modal-auth-form-group">
                <label htmlFor="register-nickname">
                  Никнейм <span className="auth-modal-optional-label">(необязательно)</span>
                </label>
                <input
                  id="register-nickname"
                  type="text"
                  placeholder="Введите никнейм"
                  value={regNickname}
                  onChange={(e) =>
                    handleRegFieldChange('nickname', e.target.value)
                  }
                  disabled={loadingRegister}
                  className={regErrors.nickname ? 'auth-modal-error' : ''}
                />
                {regErrors.nickname && (
                  <span className="auth-modal-auth-error">{regErrors.nickname}</span>
                )}
              </div>

              <div className="auth-modal-auth-form-group">
                <label htmlFor="register-password">
                  Пароль <span className="auth-modal-required-star">*</span>
                </label>
                <div className="auth-modal-password-input-wrapper">
                  <input
                    id="register-password"
                    type={showRegPassword ? 'text' : 'password'}
                    placeholder="Минимум 8 символов"
                    value={regPassword}
                    onChange={(e) =>
                      handleRegFieldChange('password', e.target.value)
                    }
                    required
                    minLength={8}
                    disabled={loadingRegister}
                    className={regErrors.password ? 'auth-modal-error' : ''}
                  />
                  <button
                    type="button"
                    className="auth-modal-password-toggle"
                    onClick={() => setShowRegPassword(!showRegPassword)}
                    tabIndex="-1"
                    disabled={loadingRegister}
                  >
                    <img
                      className="auth-modal-password-toggle-icon"
                      src={showRegPassword ? eye_crossed : eye}
                      alt="Видимость пароля"
                    />
                  </button>
                </div>
                {regErrors.password && (
                  <span className="auth-modal-auth-error">{regErrors.password}</span>
                )}
                {regPassword && !regErrors.password && passwordStrength && (
                  <div className="auth-modal-password-strength">
                    <div
                      className={`auth-modal-password-strength-bar ${passwordStrength.class}`}
                    ></div>
                    <span
                      className={`auth-modal-password-strength-text ${passwordStrength.class}`}
                    >
                      {passwordStrength.label}
                    </span>
                  </div>
                )}
              </div>

              <div className="auth-modal-auth-form-group">
                <label htmlFor="register-confirm-password">
                  Подтверждение пароля <span className="auth-modal-required-star">*</span>
                </label>
                <div className="auth-modal-password-input-wrapper">
                  <input
                    id="register-confirm-password"
                    type={showRegConfirmPassword ? 'text' : 'password'}
                    placeholder="Повторите пароль"
                    value={regConfirmPassword}
                    onChange={(e) =>
                      handleRegFieldChange('confirmPassword', e.target.value)
                    }
                    required
                    minLength={8}
                    disabled={loadingRegister}
                    className={regErrors.confirmPassword ? 'auth-modal-error' : ''}
                  />
                  <button
                    type="button"
                    className="auth-modal-password-toggle"
                    onClick={() =>
                      setShowRegConfirmPassword(!showRegConfirmPassword)
                    }
                    tabIndex="-1"
                    disabled={loadingRegister}
                  >
                    <img
                      className="auth-modal-password-toggle-icon"
                      src={showRegConfirmPassword ? eye_crossed : eye}
                      alt="Видимость пароля"
                    />
                  </button>
                </div>
                {regErrors.confirmPassword && (
                  <span className="auth-modal-auth-error">{regErrors.confirmPassword}</span>
                )}
              </div>

              {/* Обязательные юридические согласия по законодательству РФ */}
              <div className="auth-modal-legal-consents">
                <label className="auth-modal-consent-label">
                  <input
                    type="checkbox"
                    checked={privacyAccepted}
                    onChange={(e) => {
                      setPrivacyAccepted(e.target.checked);
                      setRegErrors((prev) => ({ ...prev, legal: '' }));
                    }}
                    disabled={loadingRegister}
                  />
                  <span>
                    Даю согласие на обработку персональных данных в соответствии с 152-ФЗ и{' '}
                    <button
                      type="button"
                      className="auth-modal-inline-doc-link"
                      onClick={() => setLegalDocModal('privacy')}
                    >
                      Политикой конфиденциальности
                    </button>{' '}
                    <span className="auth-modal-required-star">*</span>
                  </span>
                </label>

                <label className="auth-modal-consent-label">
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => {
                      setTermsAccepted(e.target.checked);
                      setRegErrors((prev) => ({ ...prev, legal: '' }));
                    }}
                    disabled={loadingRegister}
                  />
                  <span>
                    Подтверждаю достижение возраста 18 лет (436-ФЗ) и принимаю{' '}
                    <button
                      type="button"
                      className="auth-modal-inline-doc-link"
                      onClick={() => setLegalDocModal('terms')}
                    >
                      Пользовательское соглашение
                    </button>{' '}
                    <span className="auth-modal-required-star">*</span>
                  </span>
                </label>

                {regErrors.legal && (
                  <span className="auth-modal-auth-error">{regErrors.legal}</span>
                )}
              </div>

              <button
                type="submit"
                className="auth-modal-auth-submit-button"
                disabled={
                  loadingRegister ||
                  hasRegErrors ||
                  isRegEmpty ||
                  loginCheckStatus === 'checking' ||
                  loginCheckStatus === 'taken'
                }
              >
                Далее
              </button>

              <div className="auth-modal-auth-form-footer">
                Уже есть аккаунт?{' '}
                <a onClick={() => onTabChange && onTabChange('login')}>Войти</a>
              </div>
            </form>
          ) : (
            <PreferencesFormContent
              initialGenres={preferredGenres}
              initialArtistIds={preferredArtistIds}
              onCancel={() => setRegStep('credentials')}
              onComplete={handleCompleteRegistration}
              submitLabel={
                loadingRegister ? 'Отправка заявки...' : 'Отправить заявку'
              }
            />
          )}
        </div>
      </>
    );
  }

  return null;
}